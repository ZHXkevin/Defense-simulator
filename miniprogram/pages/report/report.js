// pages/report/report.js

Page({
  data: {
    // 原始数据
    strictScore: 0,
    warmScore: 0,
    strictFeedback: '',
    warmFeedback: '',

    // 评分依据（摘要版，非全文）
    standardSummary: '',
    otherInstruction: '',

    // 报告生成数据
    avgScore: 0,
    grade: {},
    diffAnalysis: '',
    diffPercent: 0,
    dimensions: [],
    improvements: [],
    suggestions: [],
    activeTab: 'strict'
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const app = getApp()
    // ===== 从 currentReport 读取数据 =====
    const data = app.globalData.currentReport || {}
    const gd = app.globalData || {}

    // 从 currentReport 获取反馈
    let strictFeedback = data.strict_feedback || gd.strictFeedback || gd.strictResult || ''
    let warmFeedback = data.warm_feedback || gd.warmFeedback || gd.warmResult || ''

    const extractScore = (text) => {
      if (!text || typeof text !== 'string') return null
      let m = text.match(/(?:分数|得分|score)[：:]\s*(\d+)/i)
      if (m) return parseInt(m[1])
      m = text.match(/(\d+)\s*分/)
      if (m) return parseInt(m[1])
      m = text.match(/\b(\d{1,3})\b/)
      if (m) {
        const n = parseInt(m[1])
        if (n >= 0 && n <= 100) return n
      }
      return null
    }

    // 优先从 currentReport 取分数
    let strictScore = data.strict_score
    let warmScore = data.warm_score

    if (strictScore == null || isNaN(strictScore)) {
      strictScore = extractScore(strictFeedback)
    }
    if (warmScore == null || isNaN(warmScore)) {
      warmScore = extractScore(warmFeedback)
    }

    strictScore = (strictScore != null && strictScore >= 0 && strictScore <= 100) ? strictScore : 0
    warmScore = (warmScore != null && warmScore >= 0 && warmScore <= 100) ? warmScore : 0

    if (!strictFeedback.trim()) strictFeedback = '分数：0\n依据：未获取到评分数据\n反馈：请重新提交回答'
    if (!warmFeedback.trim()) warmFeedback = '分数：0\n依据：未获取到评分数据\n反馈：请重新提交回答'

    // 从 currentReport 读取文件信息
    const standardText = gd.standard?.text || ''
    const otherInstruction = gd.otherInstruction || ''

    const standardSummary = this.extractStandardSummary(standardText)

    const report = this.generateReport(strictScore, warmScore, strictFeedback, warmFeedback, standardSummary, otherInstruction)

    this.setData({
      strictScore,
      warmScore,
      strictFeedback,
      warmFeedback,
      standardSummary,
      otherInstruction,
      ...report
    })
  },

  // ===== 以下方法保持不变 =====
  extractStandardSummary(fullText) {
    if (!fullText || fullText.length < 20) return ''

    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 5)

    const keywords = [
      '分数', '分值', '得分', '评分', '权重', '占比', '比例',
      '逻辑', '论证', '论据', '推理', '严谨',
      '表达', '清晰', '语言', '结构', '层次', '流畅',
      '内容', '完整', '全面', '充实', '深度', '广度',
      '创新', '亮点', '价值', '意义', '贡献',
      '规范', '格式', '引用', '文献', '学术', '图表',
      '时间', '答辩', '回答', '提问', '应变'
    ]

    const summaryLines = []
    const seen = new Set()
    for (const line of lines) {
      const lower = line.toLowerCase()
      if (keywords.some(k => lower.includes(k)) && !seen.has(line)) {
        seen.add(line)
        summaryLines.push(line)
        if (summaryLines.length >= 8) break
      }
    }

    if (summaryLines.length < 3) {
      summaryLines.length = 0
      for (const line of lines.slice(0, 5)) {
        if (!seen.has(line)) {
          seen.add(line)
          summaryLines.push(line)
        }
      }
    }

    let summary = summaryLines.join('\n')
    if (summary.length > 400) {
      summary = summary.substring(0, 400)
      const lastPeriod = Math.max(summary.lastIndexOf('。'), summary.lastIndexOf('\n'))
      if (lastPeriod > 300) summary = summary.substring(0, lastPeriod + 1)
      summary += '\n...'
    }

    return summary
  },

  generateReport(sScore, wScore, sFeedback, wFeedback, standardSummary, otherInstruction) {
    const avg = Math.round((sScore + wScore) / 2)
    const diff = Math.abs(sScore - wScore)

    const gradeMap = [
      { min: 90, text: '优秀', color: '#10b981', desc: '表现突出，具备优秀答辩水平' },
      { min: 80, text: '良好', color: '#3b82f6', desc: '整体良好，细节仍可精进' },
      { min: 70, text: '中等', color: '#f59e0b', desc: '基本达标，有较大提升空间' },
      { min: 60, text: '及格', color: '#f97316', desc: '勉强通过，需重点补强' },
      { min: 30, text: '较弱', color: '#ef4444', desc: '基础薄弱，建议重新梳理核心内容' },
      { min: 0,  text: '待改进', color: '#991b1b', desc: '尚未达标，存在严重缺漏或离题' }
    ]
    const grade = gradeMap.find(g => avg >= g.min) || gradeMap[gradeMap.length - 1]

    let diffAnalysis = ''
    let diffPercent = Math.min(100, diff * 5)
    if (diff >= 20) {
      diffAnalysis = `专家与导师评价差异显著（差距${diff}分）。你的回答在不同评审视角下呈现极端分化，可能存在"专业深度够但表达极差"或"想法好但论证弱"的结构性失衡。建议拆分两位评委的反馈，分别建立优化清单。`
    } else if (diff >= 10) {
      diffAnalysis = `评价存在一定分歧（差距${diff}分）。整体方向一致，但在深度、表达或完整性上存在认知差异。建议优先解决专家指出的硬伤，同时保留导师认可的亮点。`
    } else {
      diffAnalysis = `评价高度一致（差距仅${diff}分）。两位评委对你的表现判断趋同，说明当前水平稳定，不存在明显的认知偏差。可按照统一反馈进行系统性提升。`
    }

    const dimensions = [
      { 
        name: '逻辑论证', 
        score: this.clamp(avg + (sScore - wScore) * 0.3 + (Math.random() * 6 - 3)),
        color: '#4f46e5',
        desc: '论证链条的严谨性与推理过程'
      },
      { 
        name: '表达清晰', 
        score: this.clamp(avg + (wScore - sScore) * 0.3 + (Math.random() * 6 - 3)),
        color: '#06b6d4',
        desc: '语言组织、结构层次与可读性'
      },
      { 
        name: '专业深度', 
        score: this.clamp(avg + (sScore - 75) * 0.2 + (Math.random() * 6 - 3)),
        color: '#8b5cf6',
        desc: '理论运用、数据支撑与学术规范'
      },
      { 
        name: '内容完整', 
        score: this.clamp(avg + (wScore - 75) * 0.2 + (Math.random() * 6 - 3)),
        color: '#ec4899',
        desc: '要点覆盖、边界说明与细节充实度'
      },
      { 
        name: '创新亮点', 
        score: this.clamp(avg + (wScore - sScore) * 0.15 + (Math.random() * 6 - 3)),
        color: '#f59e0b',
        desc: '独特视角、批判性思维与价值增量'
      }
    ]

    const improvements = []
    
    if (sScore < 60) {
      improvements.push('基础补强：专家评分较低，核心理论与论证逻辑需要重新梳理，建议回归文献夯实基础，重建论证框架。')
    } else if (sScore < 75) {
      improvements.push('逻辑精进：专家评分中等，论证过程的严谨性和数据支撑力度有待加强，建议补充实证材料与反例讨论。')
    }

    if (wScore < 60) {
      improvements.push('表达重构：导师评分较低，语言组织和表达清晰度存在明显问题，建议重写关键段落并反复朗读打磨。')
    } else if (wScore < 75) {
      improvements.push('表达优化：导师评分中等，建议采用"总-分-总"结构优化段落层次，减少长句与歧义表述。')
    }

    if (diff >= 15) {
      improvements.push('认知对齐：双评差异显著，说明你的回答在不同标准下表现不稳定。建议收集更多模拟评审意见，找到最大公约数。')
    }

    if (avg >= 85) {
      improvements.push('冲刺顶尖：当前已达良好水平，可向优秀冲刺。建议增加跨学科视角、前沿理论引用和边界条件探讨。')
    } else if (avg >= 70) {
      improvements.push('深度拓展：建议在现有框架上增加对比分析、机制解释或敏感性检验，展现批判性思维与学术视野。')
    } else {
      improvements.push('系统提升：建议制定分阶段改进计划，先解决专家指出的硬伤（逻辑/深度），再按导师建议打磨细节（表达/完整）。')
    }

    if (standardSummary && standardSummary.length > 10) {
      improvements.push(`标准对齐：本次评分已参考您提供的评分标准。建议逐条对照标准中的核心维度，检查回答是否覆盖了所有评分要点，特别是标准中强调的高权重项。`)
    }
    if (otherInstruction && otherInstruction.length > 5) {
      improvements.push(`个性化关注：您曾提出特殊要求（"${otherInstruction.substring(0, 40)}${otherInstruction.length > 40 ? '...' : ''}"），建议检查回答是否充分回应了这些个性化需求。`)
    }

    const sBasis = this.extractSection(sFeedback, '依据')
    const sSuggest = this.extractSection(sFeedback, '反馈')
    const wBasis = this.extractSection(wFeedback, '依据')
    const wSuggest = this.extractSection(wFeedback, '反馈')

    const suggestions = []

    suggestions.push(`针对专家指出的"${sBasis || '核心问题'}"，${sSuggest || '建议对照评分标准逐条检查论证漏洞'}。优先修改专家反馈中的硬性错误。`)
    suggestions.push(`结合导师认可的"${wBasis || '亮点方向'}"，${wSuggest || '建议在保持优势的基础上优化表达形式'}。用更清晰的结构呈现已有深度。`)

    if (sScore < wScore) {
      suggestions.push(`扬长补短：导师认可你的整体思路（${wScore}分），但专家指出执行层面的问题（${sScore}分）。建议保留大框架，重点修改细节论证与数据支撑。`)
    } else if (sScore > wScore) {
      suggestions.push(`软硬兼顾：专家认可你的专业深度（${sScore}分），但导师认为表达与呈现不足（${wScore}分）。建议在保持深度的同时，用图表、分点、案例降低理解成本。`)
    } else {
      suggestions.push(`全面打磨：两位评委评分一致（${sScore}分），建议建立统一的问题清单，按"重要性×修改成本"排序逐项攻克，避免遗漏。`)
    }

    suggestions.push('模拟演练：修改完成后，进行2-3次计时模拟答辩（建议每次15分钟），录音回放检查语言流畅度、时间控制与肢体表达。')
    suggestions.push('复查清单：最终提交前，使用"三读法"自查——一读逻辑（论点→论据→结论是否通顺），二读细节（数据、引用、格式是否准确），三读表达（删除冗余词、统一术语）。')

    return {
      avgScore: avg,
      grade,
      diffAnalysis,
      diffPercent,
      dimensions,
      improvements,
      suggestions
    }
  },

  clamp(num) {
    return Math.max(0, Math.min(100, Math.round(num)))
  },

  extractSection(str, key) {
    if (!str) return ''
    const regex = new RegExp(`${key}[：:]\\s*([^\\n]+)`)
    const match = String(str).match(regex)
    return match ? match[1].trim() : ''
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  onShareAppMessage() {
    const { avgScore, grade } = this.data
    return {
      title: `我的答辩分析报告：${avgScore}分（${grade.text}）`,
      path: '/pages/index/index'
    }
  }
})