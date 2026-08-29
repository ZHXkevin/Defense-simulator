// utils/storage.js

const CACHE_KEY = 'training_progress'

function saveProgress(data) {
  try {
    // 如果 data 中没有 isCompleted，默认为 false
    const progress = {
      ...data,
      isCompleted: data.isCompleted || false,
      lastUpdate: new Date().toLocaleString()
    }
    wx.setStorageSync(CACHE_KEY, progress)
  } catch (err) {
    console.error('保存进度失败:', err)
  }
}

function loadProgress() {
  try {
    return wx.getStorageSync(CACHE_KEY) || null
  } catch (err) {
    return null
  }
}

function clearProgress() {
  try {
    wx.removeStorageSync(CACHE_KEY)
  } catch (err) {
    console.error('清除进度失败:', err)
  }
}

function markCompleted() {
  try {
    const progress = loadProgress()
    if (progress) {
      progress.isCompleted = true
      wx.setStorageSync(CACHE_KEY, progress)
      console.log('✅ 训练已标记为完成')
    }
  } catch (err) {
    console.error('标记完成失败:', err)
  }
}

function hasUnfinishedTraining() {
  const progress = loadProgress()
  // 有进度、有内容、且未完成
  return progress && progress.content && !progress.isCompleted
}

module.exports = {
  saveProgress,
  loadProgress,
  clearProgress,
  markCompleted,
  hasUnfinishedTraining
}