<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import LogSum from './components/LogSum.vue'
import { useToast } from 'primevue/usetoast'
const toast = useToast()
const issueGeneratorURL = 'https://10.26.97.22:7814/homepage'
const iLogURL = 'ws://10.26.97.76:8000/iLogger'

// Config panel refs
const initializing = ref(true)
const paused = ref(true)
const copyPasteMenu = ref()
const eventCommands = ref([
  {
    label: 'Error 1: Process down',
    icon: 'pi pi-exclamation-triangle',
    command: () => {
      eventCause.value =
        'Unable to communicate with process $VASKY - $ISERV52.AAX0601.UMPSKYI. Error 1.'
    }
  },
  {
    label: 'Error 45: File full',
    icon: 'pi pi-file-excel',
    command: () => {
      eventCause.value = 'Unable to write to $WORK1.UTILS.FULLFILE. Error 45.'
    }
  }
])
const issueType = ref('EXECUTE')
const entities = ref([
  { name: 'Process', value: 'process' },
  { name: 'CPU', value: 'cpu' }
])
const selectedEntity = ref(null)
const causes = ref({
  process: [
    { name: 'Looping', value: 'looping' },
    { name: 'Message Writer', value: 'msg_recv' }
  ],
  cpu: [{ name: 'Queue Length', value: 'q_len' }]
})
const filteredCauses = computed(() => {
  return selectedEntity.value ? causes.value[selectedEntity.value.value] : []
})
const selectedCause = ref(null)
const owners = ref([{ name: 'TANDEM.EMS' }])
const selectedOwner = ref(null)
const eventCause = ref(null)

// TabView props
const loading = ref(false)

// LogSumTabs type to be reused
const LogSumTabs = [
  { title: 'iDetectE', latestTimestamp: '', msgs: [], disabled: true },
  { title: 'iDetectS', latestTimestamp: '', msgs: [], disabled: true },
  { title: 'iSolve', latestTimestamp: '', msgs: [], disabled: true },
  { title: 'iDo', latestTimestamp: '', msgs: [], disabled: true }
]

/**
 * structured as below:
 * {
 *   taskID: {
 *     title: String,               // title of the TabView's tab
 *     activeLogSumTabs: Number[],  // active tabs of LogSum's tabs
 *     logSumTabs: LogSumTabs       // LogSumTabs type defined above
 *   }
 * }
 * */
const tabs = ref({})

// LogSum props
const performanceSum = ref({})
const loggersDic = Object.freeze({
  iDetectE: 0,
  iDetectS: 1,
  iSolve: 2,
  iDo: 3
})

// WebSocket
let iLogSocket

// Close WebSocket connection before reloading or closing the page
window.addEventListener('unload', () => {
  iLogSocket.close()
  console.log('WebSocket closed.')
})

onMounted(() => {
  iLogSocket = new WebSocket(iLogURL)
  toast.add({
    severity: 'info',
    summary: 'Connecting to iLog...',
    detail: 'Establishing connection to iLog. Please wait...',
    closable: false,
    group: 'sticky'
  })
  iLogSocket.addEventListener('open', iLogOpened)
  iLogSocket.addEventListener('message', iLogMessage)
  iLogSocket.addEventListener('error', iLogError)
  resetConfigs()
})

onUnmounted(() => {
  iLogSocket.close()
  console.log('WebSocket closed before unmounted.')
  performance.clearMarks()
  performance.clearMeasures()
})

// Watchers
watch(issueType, () => {
  switch (issueType.value) {
    case 'EXECUTE':
      selectedEntity.value = entities.value[0]
      selectedOwner.value = null
      break
    case 'WRITETOEMS':
      selectedEntity.value = null
      selectedOwner.value = owners.value[0]
      break
  }
})

watch(selectedEntity, () => {
  if (selectedEntity.value) {
    selectedCause.value = filteredCauses.value[0]
  } else {
    selectedCause.value = null
  }
})

watch(selectedOwner, () => {
  eventCause.value = null
})

function sendStopToILog() {
  toast.removeGroup('sticky')
  try {
    iLogSocket.send(
      JSON.stringify({
        action: 'stop'
      })
    )
    console.log('Stop message sent.')
    paused.value = true
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'iLog Error',
      detail: e.message,
      group: 'sticky'
    })
  }
}

function resetConfigs() {
  issueType.value = 'EXECUTE'
  selectedEntity.value = entities.value[0]
  selectedCause.value = causes.value[entities.value[0].value][0]
  selectedOwner.value = null
  eventCause.value = null
}

function resetTabs() {
  loading.value = false
  toast.removeAllGroups()
  sendStopToILog()
  tabs.value = {}
  performanceSum.value = {}
  performance.clearMarks()
  performance.clearMeasures()
}

function reset() {
  resetConfigs()
  resetTabs()
}

function iLogOpened() {
  initializing.value = false
  toast.add({
    severity: 'success',
    summary: 'Connected!',
    detail: 'Connection to iLog has been established.',
    life: 3000
  })
  sendStopToILog()
}

function iLogError(event) {
  toast.removeGroup('sticky')
  toast.add({
    severity: 'error',
    summary: 'iLog Error',
    detail: 'iLog error. See console for details.',
    group: 'sticky'
  })
  console.log(event)
}

// Data would come with previous messages in an array when first responded.
// Subsequent messages will be objects either with `logger`, or just a `taskID` as the task is being created.
// Use the `taskID` to sort the subsequent messages into tabs.
function iLogMessage(event) {
  let data = JSON.parse(event.data)
  console.log(data)
  if (Array.isArray(data)) {
    // first time response
    data.forEach((log) => {
      logHandler(log)
    })
  } else {
    // subsequent responses
    logHandler(data)
  }
}

function toggleCopyPasteMenu(event) {
  copyPasteMenu.value.toggle(event)
}

// Helper functions
function logHandler(data) {
  // initialize new tab if the id doesn't exist yet
  tabs.value[data.taskID] ??= {
    title: data.taskID.split('-')[0], // temporary title
    activeLogSumTabs: [],
    logSumTabs: structuredClone(LogSumTabs)
  }

  if (data.logger) {
    loading.value = false
    toast.removeGroup('sticky')
    const loggerIndex = loggersDic[data.logger]
    if (loggerIndex === -1) {
      toast.add({
        severity: 'warn',
        summary: 'iLog Error',
        detail: 'iLog error. See console for details.',
        life: 3000
      })
      console.log(`Logger: ${data.logger} not found. Skipping...`)
    } else {
      const target = tabs.value[data.taskID]
      target.activeLogSumTabs.push(loggerIndex)
      let timestamp = new Date(parseInt(data['when'])).toLocaleTimeString('en-US')
      target.logSumTabs[loggerIndex].latestTimestamp = timestamp
      target.logSumTabs[loggerIndex].disabled = false
      target.logSumTabs[loggerIndex].msgs.push({ timestamp, content: msgParser(data, timestamp) })
    }
  }
}

function msgParser(data, timestamp) {
  let msgObj = JSON.parse(data.message)
  if (msgObj.Entity || msgObj.entity) {
    tabs.value[data.taskID].title = msgObj.Entity || msgObj.entity
  }
  performanceSum.value[data.taskID] ??= {}

  switch (data.logger) {
    case 'iDetectE':
      performance.mark(`${data.taskID}-iDetectE`)
      performanceSum.value[data.taskID].iDetectE = unitFormatter(
        performance.measure('iDetectE performance', 'start', `${data.taskID}-iDetectE`).duration
      )
      return (
        `<b>${timestamp}</b> Detected: <b>Error ${msgObj.ErrorNum}</b> from` +
        ` <b>${msgObj.Owner}.${msgObj.SubsystemID}.${msgObj.EventProcessName}</b>.` +
        ` Event message caught: <b>${msgObj.EventText}</b>`
      )
    case 'iDetectS':
      performance.mark(`${data.taskID}-iDetectS`)
      if (performance.getEntriesByName(`${data.taskID}-iDetectE`, 'mark').length === 0) {
        performanceSum.value[data.taskID].iDetectS = unitFormatter(
          performance.measure(
            'iDetectS performance without iDetectE',
            'start',
            `${data.taskID}-iDetectS`
          ).duration
        )
      } else {
        performanceSum.value[data.taskID].iDetectS = unitFormatter(
          performance.measure(
            'iDetectS performance with iDetectE',
            `${data.taskID}-iDetectE`,
            `${data.taskID}-iDetectS`
          ).duration
        )
      }
      return (
        `<b>${timestamp}</b> Detected: <b>${msgObj.entity} -> ${msgObj.metric}</b>: <b>${msgObj.ProcessName}</b> has exceeded the` +
        (msgObj.lower_bound
          ? ` predicted expectations of <b>${msgObj.lower_bound.toFixed(
              2
            )}</b> and <b>${msgObj.upper_bound.toFixed(2)}</b>`
          : ` threshold of <b>${msgObj.upper_bound.toFixed(2)}</b>`) +
        ` (was <b>${msgObj.actual_value.toFixed(2)}</b>).`
      )
    case 'iSolve':
      if (Array.isArray(msgObj)) {
        let temp = ''
        msgObj.forEach((command, index) => {
          temp += `&emsp;${command.command}: Sending command <b>${index + 1}</b> to iDo: <b><code>${
            command.execute
          }</code></b>`
        })
        performance.mark(`${data.taskID}-iSolve`)
        if (performance.getEntriesByName(`${data.taskID}-iDetectS`, 'mark').length > 0) {
          performanceSum.value[data.taskID].iSolve = unitFormatter(
            performance.measure(
              'iSolve performance without iDetectE',
              `${data.taskID}-iDetectS`,
              `${data.taskID}-iSolve`
            ).duration
          )
        } else {
          performanceSum.value[data.taskID].iSolve = unitFormatter(
            performance.measure(
              'iSolve performance with iDetectE',
              `${data.taskID}-iDetectE`,
              `${data.taskID}-iSolve`
            ).duration
          )
        }
        return temp || 'Solution not found.'
      } else {
        return `<b>${timestamp}</b> Cause: <b>${msgObj.cause}</b>, possible remedy: <b>${msgObj.remedy}</b>.`
      }
    case 'iDo':
      break
  }
}

function unitFormatter(time) {
  return time > 1000
    ? `<b>${(time / 1000).toFixed(2)}</b> seconds`
    : `<b>${time.toFixed(2)}</b> milliseconds`
}

function generateReqBody() {
  if (issueType.value === 'EXECUTE') {
    let exe = []
    if (selectedEntity.value?.value === 'process') {
      if (selectedCause.value.value === 'looping') {
        exe.push('RUN $work1.utils.VHVY /name $VHVY, nowait, TERM $ZHOME, PRI 60/')
      } else if (selectedCause.value.value === 'msg_recv') {
        exe.push('RUN $work1.utils.MSGFLOOD /name $MFLD, nowait, TERM $ZHOME, PRI 100/')
      }
    } else if (selectedEntity.value?.value === 'cpu') {
      if (selectedCause.value.value === 'q_len') {
        exe.push('RUN $work1.utils.NOOPSTRT /name $NOOP, nowait, TERM $ZHOME, PRI 100/')
      }
    }
    return {
      Operation: 'RunCommands',
      Prescriptions: [
        {
          Subsystem: '$SYSTEM.SYSTEM.TACL',
          Execute: exe
        }
      ],
      IssueId: '12345'
    }
  } else if (issueType.value === 'WRITETOEMS') {
    return {
      Operation: 'WriteEMS',
      Message: eventCause.value,
      IssueId: '12345'
    }
  }
  return {}
}

async function generate(event) {
  if (issueType.value === 'WRITETOEMS' && !eventCause.value) return

  event.preventDefault()
  resetTabs()
  toast.add({
    severity: 'info',
    summary: 'Got it!',
    detail: 'Manually causing problems...',
    closable: false,
    group: 'sticky'
  })

  // Serializing request body...
  const requestBody = new URLSearchParams({
    command: issueType.value, // 'EXECUTE' || 'WRITETOEMS'
    request_body: JSON.stringify(generateReqBody())
  }).toString()

  let generationTimestamp = Date.now()
  console.log(
    `Issue generated at: ${new Date(generationTimestamp).toLocaleString(
      'en-US'
    )} (${generationTimestamp}).`
  )

  loading.value = true
  // Send command to generate issues...
  const response = await fetch(issueGeneratorURL, {
    method: 'post',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: requestBody
  })
  toast.removeGroup('sticky')
  toast.add({
    severity: 'success',
    summary: 'Problem caused!',
    detail: 'Waiting for detection and action logs from iLog. Please wait...',
    closable: false,
    group: 'sticky'
  })
  performance.mark('start')

  // Requesting iLogs
  try {
    iLogSocket.send(
      JSON.stringify({
        action: 'query',
        timestamp: `${generationTimestamp}`
      })
    )
    paused.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'iLog Error',
      detail: e.message,
      group: 'sticky'
    })
  }
}
</script>

<template>
  <Toast group="sticky" />
  <Toast />

  <!--     Config panel    -->
  <form class="w-full md:w-30rem">
    <Card>
      <template #content>
        <div class="flex flex-column">
          <!--    System    -->
          <div class="flex align-items-center">
            <RadioButton v-model="issueType" inputId="system" name="issueType" value="EXECUTE" />
            <label for="system" class="pl-2">System</label>
          </div>
          <Dropdown
            v-model="selectedEntity"
            :options="entities"
            :disabled="issueType !== 'EXECUTE'"
            optionLabel="name"
            placeholder="Select an Entity"
            class="ml-4 mt-3"
          />
          <Dropdown
            v-model="selectedCause"
            :options="filteredCauses"
            :disabled="issueType !== 'EXECUTE'"
            optionLabel="name"
            placeholder="Select a Cause"
            class="ml-4 mt-3"
          />

          <!--    Event    -->
          <div class="flex align-items-center mt-5">
            <RadioButton v-model="issueType" inputId="event" name="issueType" value="WRITETOEMS" />
            <label for="event" class="pl-2">Event</label>
          </div>
          <Dropdown
            v-model="selectedOwner"
            :options="owners"
            :disabled="issueType !== 'WRITETOEMS'"
            optionLabel="name"
            placeholder="Select an App"
            class="ml-4 mt-3"
          />
          <div class="p-inputgroup">
            <InputText
              type="text"
              v-model="eventCause"
              :disabled="issueType !== 'WRITETOEMS'"
              class="ml-4 mt-3"
              placeholder="Enter a Cause"
              :required="issueType === 'WRITETOEMS'"
            />
            <Button
              class="mt-3"
              icon="pi pi-bolt"
              @click="toggleCopyPasteMenu"
              :disabled="issueType !== 'WRITETOEMS'"
              v-tooltip.bottom="{ value: 'Quick commands', showDelay: 300 }"
            ></Button>
            <Menu ref="copyPasteMenu" :model="eventCommands" :popup="true" />
          </div>

          <!--    Generate    -->
        </div>
      </template>
      <template #footer>
        <div class="flex justify-content-between column-gap-2">
          <div>
            <Button
              icon="pi pi-check"
              label="Generate"
              type="submit"
              @click="generate"
              :loading="initializing"
            />
            <Button
              class="ml-2"
              icon="pi pi-replay"
              label="Reset"
              type="reset"
              severity="warning"
              @click="reset"
              :loading="initializing"
            />
          </div>
          <Button
            icon="pi pi-pause"
            :severity="paused ? 'secondary' : 'danger'"
            rounded
            text
            @click="sendStopToILog"
            :disabled="paused"
            v-tooltip.bottom="{ value: 'Pause stream', showDelay: 300 }"
          />
        </div>
      </template>
    </Card>
  </form>
  <!--     Result Summary    -->
  <div v-if="Object.keys(tabs).length > 0" class="result-summary-section">
    <TabView :scrollable="true" class="log-sum-tab-view">
      <TabPanel v-for="(tab, taskID) in tabs" :key="tab.title" :header="tab.title">
        <LogSum :tabs="tab.logSumTabs" :active-tabs="tab.activeLogSumTabs" :loading="loading" />
        <Fieldset legend="Performance">
          <ol>
            <li v-for="(time, item) in performanceSum[taskID]" :key="item">
              <span class="tab">{{ item }}:</span> <span v-html="time"></span>
            </li>
          </ol>
        </Fieldset>
      </TabPanel>
    </TabView>
  </div>
  <div v-else-if="loading" class="result-summary-section">
    <TabView class="log-sum-tab-view">
      <TabPanel>
        <template #header>
          <Skeleton width="5rem"></Skeleton>
        </template>
        <LogSum :tabs="LogSumTabs" :loading="loading" />
        <Fieldset legend="Performance">
          <Skeleton width="25rem" class="mb-2"></Skeleton>
          <Skeleton width="18rem" class="mb-2"></Skeleton>
          <Skeleton width="23rem" class="mb-2"></Skeleton>
        </Fieldset>
      </TabPanel>
    </TabView>
  </div>
  <ScrollTop />
</template>

<style scoped>
.result-summary-section {
  max-width: calc(1280px - 25px - 4rem - 30rem);
}

@media (max-width: 768px) {
  .result-summary-section {
    width: 100%;
  }
}
</style>
