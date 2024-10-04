<script setup>
import { ref, watch } from 'vue'
import { IconFullscreen, IconCheck } from '@arco-design/web-vue/es/icon'
import { judgeImagePath } from '../utils/utils'

const emit = defineEmits(['ok', 'close'])
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  list: {
    type: Object,
    // eslint-disable-next-line vue/require-valid-default-prop
    default: {}
  },
  multiple: {
    type: Boolean,
    default: false
  },
  selectedKeys: {
    type: Array,
    // eslint-disable-next-line vue/require-valid-default-prop
    default: []
  },
  projectPath:{
    type: String,
    default: ''
  }
})
const imageList = ref({})
const selectedList = ref([])
const pageSize = ref(20)
const page = ref(1)
const handleOk = () => {
  emit('ok', selectedList.value)
}
const handleCancel = () => {
  emit('close')
}
const toggleSelect = (item) => {
  if (!item[1]['selected'] && !props.multiple && selectedList.value.length) {
    return
  }
  item[1]['selected'] = !item[1]['selected']
  if (item[1]['selected']) {
    selectedList.value.push(item[0])
  } else {
    selectedList.value = selectedList.value.filter(i => i !== item[0])
  }
  checkAll()
}
const imagePreviewSrc = ref("")
const imagePreviewVisible = ref(false)
const showingList = ref([])
watch(() => props.visible, (val) => {
  if (val) {
    page.value = 1
    pageSize.value = 20
    imageList.value = JSON.parse(JSON.stringify(props.list))
    selectedList.value = JSON.parse(JSON.stringify(props.selectedKeys))
    for (let key in imageList.value) {
      imageList.value[key] && (imageList.value[key]['selected'] = false)
    }
    selectedList.value.forEach(key => {
      imageList.value[key] && (imageList.value[key]['selected'] = true)
    })
    paginate()
  }
})
const selectAllValue = ref(false)
const paginate = () => {
  showingList.value = Object.entries(imageList.value).slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  checkAll()
}
const checkAll = () => {
  selectAllValue.value = true
  showingList.value.forEach(item => {
    if (!selectedList.value.includes(item[0])) {
      selectAllValue.value = false
    }
  })
}
const toggleAll = (e) => {
  showingList.value.forEach(item => {
    item[1]['selected'] = e
    if (e) {
      selectedList.value.push(item[0])
    } else {
      selectedList.value = selectedList.value.filter(i => i !== item[0])
    }
  })
  checkAll()
}
</script>

<template>
  <a-drawer class="relative" width="50%" :visible="props.visible" @ok="handleOk" @cancel="handleCancel" unmountOnClose>
    <template #title>
      选择图片（已选择 {{ selectedList.length }}{{ props.multiple ? '' : '/1' }} 张）
      <div class="absolute right-10 top-3.5" v-if="props.multiple">
        <a-checkbox @change="toggleAll" :model-value="selectAllValue">本页全选</a-checkbox>
      </div>
    </template>

    <a-image-preview
        :src="judgeImagePath(imagePreviewSrc,props.projectPath)"
        v-model:visible="imagePreviewVisible"
    />
    <a-pagination @change="current => {
      page=current
      paginate()
    }" @page-size-change="size => {
      pageSize=size
      paginate()
    }" :page-size="pageSize"
                  :total="Object.keys(imageList).length" show-jumper show-page-size show-total/>
    <div class="flex flex-wrap gap-1 mt-2">
      <div
          class="relative cursor-pointer transition-all"
          :class="!props.multiple && selectedList.length && selectedList[0]!==item[0]?'opacity-50 cursor-not-allowed':''"
          v-for="item in showingList" :key="item[0]"
          @click="toggleSelect(item)"
      >
        <img class="rounded transition-all w-[200px] h-[200px] object-cover"
             :class="imageList[item[0]]['selected']?'scale-95 outline-2 outline-blue-600 outline':''"
             :src="judgeImagePath(item[1].thumbnail || item[1].img, props.projectPath)"/>
        <div style="position: absolute; left:10px; top: 10px;background: rgba(255,255,255,0.6)"
             @click.stop="()=>{
              imagePreviewVisible=true
              imagePreviewSrc=item[1].img
             }"
             class="shadow rounded text-lg text-black w-6 h-6 text-center flex items-center justify-center">
          <icon-fullscreen class="align-middle"/>
        </div>
        <div style="position: absolute; right: 15px; bottom: 15px"
             class="shadow rounded text-white w-5 h-5 bg-blue-600 text-center flex items-center justify-center"
             v-if="imageList[item[0]]['selected']">
          <icon-check class="align-middle"/>
        </div>
        <div style="position: absolute; right: 10px; bottom: 10px"
             class="shadow rounded text-white w-5 h-5 bg-gray-200 border-2 text-center flex items-center justify-center"
             v-else>

        </div>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>

</style>
