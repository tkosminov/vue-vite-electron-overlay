<template>
  <div class="container"></div>
  <div class="content-block">
    <div class="content">
      <span>Vite vue overlay</span>
      <br /><span><b>Alt + Q</b> to toggle overlay display</span> <br /><span><b>Alt + A</b> to toggle setIgnoreMouseEvents</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const ipcRenderer = reactive({ ...window.electron.ipcRenderer })

ipcRenderer.on('overlay-window-blur', () => {
  console.log('overlay-window-blur')
})

ipcRenderer.on('overlay-window-focus', () => {
  console.log('overlay-window-focus')
})
</script>

<style>
.container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid red;
  background: rgba(255, 255, 255, 0.04);
  box-sizing: border-box;
  pointer-events: none;
  overflow: hidden;
}

.content-block {
  padding-top: 50vh;
  text-align: center;
}

.content {
  padding: 16px;
  border-radius: 8px;
  background: rgb(255, 255, 255);
  border: 4px solid red;
  display: inline-block;
}
</style>
