// pages/answer/answer.js

Page({
  data: {
    question: '',
    answer: '',
    loading: false,
    // ===== 三种模式 =====
    modeIndex: 0,  // 0=不计时, 1=计时仅自己看, 2=计时传给导师
    modeOptions: [
      { icon: '⏸️', name: '不计时', desc: '自由练习，无时间限制' },
      { icon: '👁️', name: '计时（仅自己查看）', desc: '计时器显示，不影响评分' },
      { icon: '📤', name: '计时（传给导师）', desc: '计时器显示，时间纳入评分' }
    ],
    modeLabels: ['⏸️ 不计时', '👁️ 仅自己', '📤 传给导师'],
    showModePopup: false,
    // ===== 计时器数据 =====
    timerDisplay: '00:00',
    seconds: 0,
    isRunning: false,
    isFinished: false,
    timerInterval: null
  },

  onShow() {
    const app = getApp()
    if (app.globalData && app.globalData.currentQuestion) {
      this.setData({ question: app.globalData.currentQuestion })
    }
    // 从缓存读取模式偏好
    const saved = wx.getStorageSync('answerModeIndex')
    if (saved !== '' && saved !== undefined) {
      this.setData({ modeIndex: saved })
    }
    this.resetTimer()
  },

  onHide() {
    this.stopTimer()
  },

  onUnload() {
    this.stopTimer()
  },

  onAnswerInput(e) {
    this.setData({ answer: e.detail.value })
  },

  // ===== 切换模式弹窗 =====
  toggleModeSelector() {
    this.setData({ showModePopup: true })
  },

  closeModePopup() {
    this.setData({ showModePopup: false })
  },

  stopPropagation() {},

  selectMode(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ 
      modeIndex: index,
      showModePopup: false
    })
    wx.setStorageSync('answerModeIndex', index)
    this.resetTimer()
  },

  // ===== 计时器：开始 =====
  startTimer() {
    if (this.data.isRunning || this.data.modeIndex === 0) return
    this.setData({
      isRunning: true,
      isFinished: false
    })
    this.data.timerInterval = setInterval(() => {
      const newSeconds = this.data.seconds + 1
      this.setData({
        seconds: newSeconds,
        timerDisplay: this.formatTime(newSeconds)
      })
    }, 1000)
  },

  // ===== 计时器：停止 =====
  stopTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
      this.data.timerInterval = null
    }
    this.setData({
      isRunning: false,
      isFinished: true
    })
  },

  // ===== 计时器：重置 =====
  resetTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
      this.data.timerInterval = null
    }
    this.setData({
      seconds: 0,
      timerDisplay: '00:00',
      isRunning: false,
      isFinished: false
    })
  },

  // ===== 格式化时间 =====
  formatTime(totalSeconds) {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const secs = String(totalSeconds % 60).padStart(2, '0')
    return `${mins}:${secs}`
  },

  // ===== 提交答案 =====
  async submitAnswer() {
    if (!this.data.answer.trim()) {
      wx.showToast({ title: '请先输入回答', icon: 'none' })
      return
    }

    // 停止计时
    if (this.data.isRunning) {
      this.stopTimer()
    }

    // 根据模式决定是否传递时间
    const mode = this.data.modeIndex
    const timeUsed = mode === 0 ? -1 : this.data.seconds
    const shouldPassTime = mode === 2

    console.log('模式:', mode, '用时:', timeUsed >= 0 ? timeUsed + '秒' : '未计时', '是否传给导师:', shouldPassTime)

    this.setData({ loading: true })
    wx.showLoading({ title: 'AI评分中...' })

    try {
      // 读取评分标准和补充说明
      const app = getApp()
      const gd = app.globalData
      const standardText = gd.standard?.text?.trim() || ''
      const otherInstruction = gd.otherInstruction?.trim() || ''

      // 获取所有上传文件的文件名，供 AI 关联理解
      const contentName = gd.content?.name || '主文档'
      const standardName = gd.standard?.name || '评分标准'

      const model = wx.cloud.extend.AI.createModel('hunyuan-exp')

      // 构建 system prompt
      let systemContent = `你是一位专业的答辩评分专家。请对学生的回答进行两种风格的评分。`

      if (standardText) {
        systemContent += `\n\n【评分标准】\n${standardText.substring(0, 2000)}\n\n请严格对照以上评分标准进行评判，在"依据"中引用具体标准条款。`
      }
      if (otherInstruction) {
        systemContent += `\n\n【补充说明/特殊要求】\n${otherInstruction.substring(0, 500)}\n\n请在评分时特别关注以上要求是否被满足，并在反馈中明确提及。`
      }

      systemContent += `\n\n【上传文件清单】
- 主文档（答辩材料）：${contentName}
- 评分标准：${standardName}
- 补充说明中若提到"文件"、"文档"、"细则"等，请优先关联以上文件名进行理解。`

      let timeInstruction = ''
      if (mode === 0) {
        timeInstruction = '【计时说明】本次练习为不计时模式，没有记录回答用时。请勿在评分、依据或反馈中提及回答速度、用时或时间相关评价。'
      } else if (mode === 1) {
        timeInstruction = `【计时说明】本次回答用时为${timeUsed}秒，但仅为学生自我参考，不计入评分。请勿在评分、依据或反馈中提及或评价回答速度/用时。`
      } else if (mode === 2) {
        timeInstruction = `【计时说明】本次回答用时为${timeUsed}秒，时间因素已纳入评分考量。请在反馈中适当评价回答的时效性（如是否过于仓促或拖沓）。`
      }

      systemContent += `\n\n【绝对禁止】
- 禁止输出"N/A"、"无"、"待定"、"?"等非法分数
- 禁止输出小数，分数必须是整数
- 禁止不输出分数
- 禁止臆测或编造回答用时

${timeInstruction}

【输出格式 - 必须严格遵守】
===严格评分===
分数：0-100的整数
依据：具体评价依据（50字以内）
反馈：改进建议（50字以内）

===温暖评分===
分数：0-100的整数
依据：具体评价依据（50字以内）
反馈：改进建议（50字以内）

如果回答完全离题或为空，严格评分给0-20分，温暖评分给10-30分，但必须是整数。`

      let userContent = `题目：${this.data.question}\n\n学生回答：${this.data.answer}`
      if (shouldPassTime && timeUsed >= 0) {
        userContent += `\n\n（回答用时：${timeUsed}秒）`
      }
      if (standardText) {
        userContent += `\n\n评分标准摘要：${standardText.substring(0, 500)}`
      }

      const res = await model.generateText({
        model: 'hunyuan-2.0-instruct-20251111',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent }
        ]
      })

      wx.hideLoading()
      this.setData({ loading: false })

      const result = res.choices[0].message.content
      console.log('AI原始返回:', result)

      let strictMatch = result.match(/===严格评分===([\s\S]*?)(?:===温暖评分===|$)/)
      let warmMatch = result.match(/===温暖评分===([\s\S]*)/)

      let strictResult = strictMatch ? strictMatch[1].trim() : ''
      let warmResult = warmMatch ? warmMatch[1].trim() : ''

      const fixScore = (text, defaultScore) => {
        if (!text) return `分数：${defaultScore}\n依据：AI返回格式异常，已自动兜底\n反馈：建议检查回答是否离题或过于简短`
        return text.replace(/分数[：:]\s*(N\/A|无|待定|null|undefined|\?|--)/gi, `分数：${defaultScore}`)
      }

      strictResult = fixScore(strictResult, 60)
      warmResult = fixScore(warmResult, 65)

      if (!/\d+/.test(strictResult)) strictResult = `分数：60\n依据：未能正确解析\n反馈：${strictResult || '请重新作答'}`
      if (!/\d+/.test(warmResult)) warmResult = `分数：65\n依据：未能正确解析\n反馈：${warmResult || '请重新作答'}`

      app.globalData.strictResult = strictResult
      app.globalData.warmResult = warmResult
      app.globalData.timeUsed = timeUsed
      app.globalData.timeMode = mode
      app.globalData.shouldPassTime = shouldPassTime

      // ===== 保存训练记录到云数据库 =====
      const strictScoreMatch = strictResult.match(/分数[：:]\s*(\d+)/)
      const warmScoreMatch = warmResult.match(/分数[：:]\s*(\d+)/)
      const strictScore = strictScoreMatch ? parseInt(strictScoreMatch[1]) : null
      const warmScore = warmScoreMatch ? parseInt(warmScoreMatch[1]) : null

      const now = new Date()
      const timeStr = now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + ' ' + 
        String(now.getHours()).padStart(2, '0') + ':' + 
        String(now.getMinutes()).padStart(2, '0') + ':' + 
        String(now.getSeconds()).padStart(2, '0')

      try {
        const db = wx.cloud.database()
        await db.collection('training_records').add({
          data: {
            openid: app.globalData.openid || wx.getStorageSync('openid') || 'unknown',
            file_name: app.globalData.fileName || '未命名文件',
            mode: app.globalData.mode || '课程Pre汇报',
            difficulty: app.globalData.difficulty || '中等',
            question: this.data.question,
            answer: this.data.answer,
            strict_score: strictScore,
            warm_score: warmScore,
            strict_feedback: strictResult,
            warm_feedback: warmResult,
            time_used: timeUsed,
            time_mode: mode,
            create_time: timeStr
          }
        })
        console.log('✅ 训练记录已保存')
      } catch (err) {
        console.error('❌ 保存记录失败:', err)
        // 不阻塞用户跳转
      }

      wx.navigateTo({ url: '/pages/result/result' })

    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('AI 评分失败:', err)
      wx.showToast({ title: '评分失败，请重试', icon: 'none' })
    }
  }
})