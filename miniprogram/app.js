// app.js
App({
  globalData: {
    openid: '',
    env: "bargue-defense-test-d6bo2175a73c",
    // ===== 文件相关 =====
    fileName: '',
    fileSize: 0,
    content: '',
    // ===== 训练配置 =====
    mode: '',
    difficulty: '',
    // ===== 问答相关 =====
    currentQuestion: '',
    questions: [],
    // ===== 评分结果 =====
    strictResult: '',
    warmResult: '',
    timeUsed: -1,
    timeMode: 0,
    shouldPassTime: false,
    // ===== 上传文件缓存 =====
    contentName: '',
    standardName: '',
    standardText: '',
    otherInstruction: ''
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
    // ===== 获取 openid =====
    this.getOpenId()
  },

  getOpenId: function () {
    const that = this
    wx.cloud.callFunction({
      name: 'getOpenid',
      success: res => {
        const openid = res.result.openid
        that.globalData.openid = openid
        wx.setStorageSync('openid', openid)
        console.log('✅ openid 已获取:', openid)
      },
      fail: err => {
        console.error('❌ 获取 openid 失败:', err)
        const cached = wx.getStorageSync('openid')
        if (cached) {
          that.globalData.openid = cached
        }
      }
    })
  }
})