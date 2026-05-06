/**
 * 档案自动分类程序 v2.0
 * 读取 PDF 全文内容进行分析，离线运行（使用 pdfjs-dist）
 *
 * 用法: node archive-classifier.js <文件夹路径> [输出目录]
 * 示例: node archive-classifier.js D:\档案文件
 *       node archive-classifier.js D:\档案文件 D:\归档结果
 */

const fs = require('fs');
const path = require('path');

// pdfjs-dist 需要 DOMMatrix polyfill（Node.js 环境）
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1;
      this.e = 0; this.f = 0;
    }
    scale() { return this; }
    translate() { return this; }
    rotate() { return this; }
    multiply() { return this; }
    toString() { return ''; }
  };
}

// ============ 分类规则 ============

const CATEGORIES = [
  {
    code: 'A', name: 'A类-党群工作',
    keywords: [
      '党委', '党组', '党支部', '党总支', '党员', '党建', '党务',
      '纪委', '纪检监察', '纪检', '巡察', '巡视',
      '工会', '团委', '妇联', '统战', '民主党派',
      '宣传', '组织', '精神文明', '思想政治', '理论学习',
      '主题教育', '党史', '廉政', '作风建设',
      '入党', '党费', '党组织', '党性',
    ]
  },
  {
    code: 'B', name: 'B类-行政管理',
    keywords: [
      '会议纪要', '纪要', '通知', '请示', '批复',
      '制度', '章程', '管理办法', '规定', '细则',
      '报告', '总结', '计划', '简报', '函',
      '行政', '办公', '人事', '考勤',
      '任免', '招聘', '培训', '考核',
      '工作要点', '工作安排', '方案',
      '后勤', '接待', '公文', '保密',
    ]
  },
  {
    code: 'C', name: 'C类-经营管理',
    keywords: [
      '董事会决议', '董事会', '股东会', '监事会',
      '董事', '监事', '股东',
      '经营', '业务', '合同', '协议',
      '项目', '投资', '招标', '投标', '采购', '销售',
      '拆迁补偿', '拆迁', '补偿',
      '产权', '股权', '出资',
      '工程', '建设', '技术', '研发',
    ]
  },
  {
    code: 'D', name: 'D类-财务',
    keywords: [
      '财务', '会计', '审计', '税务', '税收',
      '预算', '决算', '报表', '凭证',
      '发票', '工资', '薪酬', '社保', '公积金',
      '资产', '折旧', '成本', '利润',
      '经费', '报销', '借款', '贷款', '银行',
      '收益', '分红', '费用', '收支',
    ]
  }
];

const RETENTION_RULES = [
  {
    code: 'Y', label: '永久',
    keywords: [
      '董事会决议', '股东会决议', '监事会决议',
      '章程', '年报', '年度报告',
      '名册', '花名册', '清册',
      '产权证', '房产证', '土地证',
      '资质', '许可证', '营业执照', '批准证书',
      '审计报告', '验资报告', '评估报告',
      '拆迁补偿',
      '股权', '出资',
    ]
  },
  {
    code: 'D30', label: '30年',
    keywords: [
      '合同', '协议', '制度', '管理办法', '规定', '细则',
      '会议记录', '项目', '工程',
      '人事', '任免',
      '请示', '批复',
      '规划', '计划',
    ]
  }
];

const DEFAULT_RETENTION = { code: 'D10', label: '10年' };

// ============ PDF 文本提取 ============

let pdfjsCache = null;

async function getPDFjs() {
  if (!pdfjsCache) {
    pdfjsCache = await import('./node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsCache;
}

async function extractText(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const pdfjs = await getPDFjs();
    const doc = await pdfjs.getDocument({
      data: buf.buffer,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join('') + '\n';
    }
    return { text: text.trim(), pages: doc.numPages };
  } catch {
    return { text: '', pages: '?' };
  }
}

// ============ 分析函数 ============

function determineRetention(text, filename) {
  const combined = text + '\n' + filename;

  for (const rule of RETENTION_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) return rule;
    }
  }
  return DEFAULT_RETENTION;
}

function determineCategory(text, filename) {
  const combined = text + '\n' + filename;

  const scored = CATEGORIES.map(cat => {
    let score = 0;
    const matched = [];
    for (const kw of cat.keywords) {
      // 在正文中出现权重更高 (×3)
      if (text.includes(kw)) {
        score += kw.length * 3;
        matched.push(kw);
      }
      // 在文件名中出现权重中等 (×2)
      if (filename.includes(kw)) {
        score += kw.length * 2;
        if (!matched.includes(kw)) matched.push(kw);
      }
    }
    return { ...cat, score, matched };
  }).sort((a, b) => b.score - a.score);

  return scored[0].score > 0
    ? { code: scored[0].code, name: scored[0].name }
    : { code: '?', name: '未分类' };
}

// ============ 文件扫描 ============

function scanPDFs(dirPath) {
  const results = [];
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (/\.pdf$/i.test(entry.name)) results.push(fullPath);
      }
    } catch {}
  }
  walk(dirPath);
  return results;
}

// ============ 创建目录结构 ============

function createArchiveStructure(baseDir) {
  const dirs = ['永久', '30年', '10年'];
  const created = [];

  for (const cat of CATEGORIES) {
    const catDir = path.join(baseDir, cat.code);
    fs.mkdirSync(catDir, { recursive: true });
    created.push(catDir);
    for (const d of dirs) {
      fs.mkdirSync(path.join(catDir, d), { recursive: true });
      created.push(path.join(catDir, d));
    }
  }

  const uncatDir = path.join(baseDir, '未分类');
  fs.mkdirSync(uncatDir, { recursive: true });
  created.push(uncatDir);
  return created;
}

// ============ 归档文件 ============

function organizeFiles(rows, outputDir) {
  let copied = 0, skipped = 0;

  for (const row of rows) {
    let dest;
    if (row.category.code === '?') {
      dest = path.join(outputDir, '未分类', row.name + '.pdf');
    } else {
      dest = path.join(outputDir, row.category.code, row.retention.label, row.name + '.pdf');
    }
    try {
      // 目标文件只读时先解除
      if (fs.existsSync(dest)) fs.chmodSync(dest, 0o644);
      fs.cpSync(row.fullPath, dest, { force: true });
      copied++;
    } catch (e) {
      skipped++;
    }
  }

  return { copied, skipped };
}

// ============ 主流程 ============

function normalizeOutput(outputPath) {
  const out = path.resolve(outputPath);
  const { root, dir, base } = path.parse(out);
  if (base === '' && dir === root) {
    const sub = path.join(out, '档案归档结果');
    console.log(`\n⚠️ 输出为磁盘根目录，已自动使用子目录: ${sub}`);
    return sub;
  }
  return out;
}

async function main() {
  const targetDir = process.argv[2];
  const outputDir = process.argv[3] || path.join(targetDir, '..', '归档结果');

  if (!targetDir) {
    console.log('用法: node archive-classifier.js <档案文件夹路径> [输出目录]');
    console.log('示例: node archive-classifier.js D:\\档案文件');
    console.log('       node archive-classifier.js D:\\档案文件 D:\\归档结果');
    process.exit(1);
  }

  const resolvedTarget = path.resolve(targetDir);
  const resolvedOutput = normalizeOutput(outputDir);

  if (!fs.existsSync(resolvedTarget)) {
    console.error(`错误: 路径不存在 - ${resolvedTarget}`);
    process.exit(1);
  }

  // ========== 扫描 ==========
  console.log(`\n📂 扫描目录: ${resolvedTarget}`);
  const files = scanPDFs(resolvedTarget);

  if (files.length === 0) {
    console.log('未找到 PDF 文件。');
    process.exit(0);
  }

  console.log(`找到 ${files.length} 个 PDF 文件\n`);

  // ========== 分析 ==========
  const header = '序号'.padEnd(6) + '文件名'.padEnd(48) + '页数'.padEnd(6) + '保管期限'.padEnd(10) + '分类';
  console.log('='.repeat(90));
  console.log(header);
  console.log('='.repeat(90));

  const rows = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const name = path.basename(filePath, '.pdf');
    const stat = fs.statSync(filePath);

    // 显示进度
    process.stdout.write(`\r正在分析第 ${i + 1}/${files.length} 个文件...`);

    // 提取全文
    const { text, pages } = await extractText(filePath);
    const contentForAnalysis = text || name;

    // 分类判断
    const retention = determineRetention(contentForAnalysis, name);
    const cat = determineCategory(contentForAnalysis, name);

    // 日期
    const date = stat.mtime.toLocaleDateString('zh-CN');

    // 判断是否是扫描件
    const isScanned = !text || text.length < 20;

    rows.push({
      index: i + 1, name, pages, date, retention, category: cat,
      fullPath: filePath, textPreview: text.substring(0, 100) || '(扫描件，无文本)',
      isScanned
    });

    const dispName = name.length > 38 ? name.substring(0, 35) + '...' : name;
    const scanned = isScanned ? ' 📷' : '';
    console.log('\r' + String(i + 1).padEnd(6) + dispName.padEnd(48) +
      String(pages).padEnd(6) + retention.label.padEnd(10) +
      `${cat.code} ${cat.name}${scanned}`);
  }

  console.log('\n' + '='.repeat(90));
  console.log(`\n✅ 共分析 ${rows.length} 个文件`);

  // ========== 统计 ==========
  console.log('\n--- 分类统计 ---');
  const catCount = {}, retCount = {};
  for (const r of rows) {
    catCount[r.category.code] = (catCount[r.category.code] || 0) + 1;
    retCount[r.retention.label] = (retCount[r.retention.label] || 0) + 1;
  }
  for (const [k, v] of Object.entries(catCount)) {
    const c = CATEGORIES.find(c => c.code === k);
    console.log(`  ${k} ${c ? c.name : '未分类'}: ${v} 份`);
  }
  console.log('\n--- 保管期限统计 ---');
  for (const [k, v] of Object.entries(retCount)) {
    console.log(`  ${k}: ${v} 份`);
  }

  // ========== CSV 导出（含正文摘要） ==========
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const csvPath = path.join(resolvedOutput, '档案分类结果.csv');
  const csvHeader = '序号,文件名,页数,生成日期,保管期限,分类代码,分类名称,扫描件,正文摘要\n';
  const csvRows = rows.map(r =>
    `${r.index},"${r.name}",${r.pages},${r.date},${r.retention.label},${r.category.code},${r.category.name},${r.isScanned ? '是' : '否'},"${(r.textPreview || '').replace(/"/g, '""')}"`
  ).join('\n');
  fs.writeFileSync(csvPath, '﻿' + csvHeader + csvRows, 'utf-8');
  console.log(`\n📄 分类清单导出: ${csvPath}`);

  // ========== 创建归档目录 ==========
  console.log('\n📁 创建归档目录...');
  createArchiveStructure(resolvedOutput);

  // ========== 归档 ==========
  console.log('📋 归档文件中...');
  const result = organizeFiles(rows, resolvedOutput);
  console.log(`   已完成: ${result.copied} 个文件` +
    (result.skipped > 0 ? ` (${result.skipped} 个跳过)` : ''));

  console.log(`\n✅ 归档完成！`);
  console.log(`📂 输出目录: ${resolvedOutput}`);
  console.log(`\n目录结构:`);
  console.log(`  ${resolvedOutput}/`);
  for (const c of CATEGORIES) {
    console.log(`  ├── ${c.code} (${c.name})/`);
    console.log(`  │   ├── 永久/`);
    console.log(`  │   ├── 30年/`);
    console.log(`  │   └── 10年/`);
  }
  console.log(`  └── 未分类/`);
}

main().catch(e => { console.error('\n错误:', e.message); process.exit(1); });
