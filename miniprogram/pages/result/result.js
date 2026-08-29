// pages/result/result.js

const { markCompleted } = require('../../utils/storage')

Page({
  data: {
    strictScore: null,
    warmScore: null,
    strictFeedback: '',
    warmFeedback: '',
    timeUsed: -1,
    // ===== 新增：存储当前报告数据 =====
    currentReport: {}
  },

  onShow() {
    markCompleted()
    console.log('✅ 训练已标记为完成')

    const app = getApp()
    const data = app.globalData || {}

    let strictResult = data.strictResult || ''
    let warmResult = data.warmResult || ''

    if (!strictResult) {
      strictResult = wx.getStorageSync('lastStrictResult') || ''
    }
    if (!warmResult) {
      warmResult = wx.getStorageSync('lastWarmResult') || ''
    }

    const strictMatch = strictResult.match(/分数[：:]\s*(\d+)/)
    const warmMatch = warmResult.match(/分数[：:]\s*(\d+)/)

    const strictScore = strictMatch ? parseInt(strictMatch[1]) : null
    const warmScore = warmMatch ? parseInt(warmMatch[1]) : null

    // ===== 构建当前报告数据 =====
    const currentReport = {
      file_name: data.fileName || '未命名文件',
      mode: data.mode || '未知模式',
      difficulty: data.difficulty || '中等',
      create_time: new Date().toLocaleString(),
      question: data.currentQuestion || '无',
      answer: data.currentAnswer || '无',
      strict_score: strictScore,
      warm_score: warmScore,
      strict_feedback: strictResult || '无',
      warm_feedback: warmResult || '无',
      time_used: data.timeUsed || -1
    }

    // ===== 存到全局 =====
    const app2 = getApp()
    app2.globalData.currentReport = currentReport

    this.setData({
      strictScore: strictScore,
      warmScore: warmScore,
      strictFeedback: strictResult || '暂无',
      warmFeedback: warmResult || '暂无',
      timeUsed: data.timeUsed || -1,
      currentReport: currentReport
    })
  },

  generateReport() {
    wx.showToast({ title: '生成报告中...', icon: 'loading' })
    
    const app = getApp()
    // ===== 确保数据存入 currentReport =====
    app.globalData.currentReport = this.data.currentReport
    
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/report/report'  // ← 跳转到 report 页面
      })
    }, 800)
  },

  backHome() {
    wx.navigateBack({ delta: 1 })
  }
})