// ==UserScript==
// @name         XJTU教务系统成绩详细提取3.0
// @namespace    http://tampermonkey.net/
// @description  可查总分和平时分
// @author       Gemini & Iroul & noisim137
// @match        https://jwxt.xjtu.edu.cn/jwapp/sys/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================== 核心配置 ==================
    const API_CURRENT_USER = "/jwapp/sys/homeapp/api/home/currentUser.do";
    const REPORT_TEMPLATE = "bkdsglxjtu/XAJTDX_BDS_CJ.cpt";
    const TABLE_ID = "#tabledqxq-index-table";
    // =============================================

    const columns = [
        { index: 0,  name: "学期",          show: "学期" },
        { index: 1,  name: "课程代码",      show: "课程代码" },
        { index: 2,  name: "课程名",        show: "课程名" },
        { index: 7,  name: "学分",          show: "学分" },
        { index: 11, name: "总成绩",        show: "总成绩" }, // 只有这里会有颜色变化
        { index: 33, name: "平时成绩",      show: "平时成绩" },
        { index: 34, name: "期末成绩",      show: "期末成绩" },
        { index: 35, name: "期中成绩",      show: "期中成绩" },
        { index: 36, name: "SYCJ_DISPLAY",  show: "实验成绩" },
        { index: 31, name: "QTCJ1_DISPLAY", show: "其他1" },
        { index: 27, name: "QTCJ2_DISPLAY", show: "其他2" },
        // 已移除“数据来源”列
    ];

    // --- 步骤 1: 获取学号 ---
    async function getStudentId() {
        try {
            const resp = await fetch(API_CURRENT_USER);
            const json = await resp.json();
            if (json.datas && json.datas.userId) {
                console.log(`✅ 学号获取成功: ${json.datas.userId}`);
                return json.datas.userId;
            }
            return null;
        } catch (e) {
            console.error("学号接口异常:", e);
            return null;
        }
    }

    // --- 步骤 2: 后台抓取报表 ---
    function fetchGradesFromIframe(studentId) {
        return new Promise((resolve) => {
            const reportUrl = `https://jwxt.xjtu.edu.cn/jwapp/sys/frReport2/show.do?reportlet=${REPORT_TEMPLATE}&__showtoolbar__=false&xh=${studentId}`;
            console.log("🚀 后台加载报表:", reportUrl);

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.top = '-10000px';
            iframe.style.width = '1200px';
            iframe.style.height = '1200px';
            iframe.src = reportUrl;
            document.body.appendChild(iframe);

            let attempts = 0;
            const maxAttempts = 60;

            const checkInterval = setInterval(() => {
                attempts++;
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc) {
                        const tds = doc.querySelectorAll("td");
                        if (tds.length > 30) {
                            console.log("✅ 报表渲染完毕，开始智能解析...");
                            const rtMap = {};

                            const rows = doc.querySelectorAll("tr");
                            rows.forEach(row => {
                                const rowTds = Array.from(row.querySelectorAll("td"));
                                const texts = rowTds.map(td => td.innerText.trim()).filter(t => t);

                                if (texts.length >= 2) {
                                    const name = texts[0];

                                    // === 核心修复逻辑 (保留 v13.3 的 A+ 修复) ===
                                    let bestScore = null;
                                    let foundLetter = false;

                                    // 倒序扫描
                                    for (let i = texts.length - 1; i >= 1; i--) {
                                        let t = texts[i];
                                        t = t.replace(/＋/g, '+').replace(/－/g, '-').replace(/–/g, '-');

                                        const isLetter = /^[A-F][\+\-]?$/i.test(t) || /^(Pass|Fail|P|F|合格|不合格|优|良|中|差)$/i.test(t);
                                        const isNumber = /^[0-9]{1,3}(\.[0-9])?$/.test(t);

                                        if (isLetter) {
                                            bestScore = t;
                                            foundLetter = true;
                                            break;
                                        }

                                        if (isNumber && !foundLetter) {
                                            if (bestScore === null) {
                                                bestScore = t;
                                            }
                                        }
                                    }

                                    const isNotHeader = !/学年|学期|课程|成绩|学分/.test(name);

                                    if (name.length > 2 && isNotHeader && bestScore) {
                                        const cleanName = name.replace(/[◆◇]/g, '').trim();
                                        rtMap[cleanName] = bestScore;
                                    }
                                }
                            });

                            clearInterval(checkInterval);
                            document.body.removeChild(iframe);
                            resolve(rtMap);
                            return;
                        }
                    }
                } catch (e) { }

                if (attempts >= maxAttempts) {
                    console.warn("❌ 报表加载超时");
                    clearInterval(checkInterval);
                    document.body.removeChild(iframe);
                    resolve({});
                }
            }, 500);
        });
    }

    // --- 主程序 ---
    function createButton() {
        if(document.getElementById('xjtu-grade-btn')) return;
        const btn = document.createElement("button");
        btn.id = 'xjtu-grade-btn';
        btn.innerHTML = "📊 提取详细成绩";
        btn.style.cssText = `position: fixed; bottom: 50px; right: 50px; z-index: 99999; padding: 10px 20px; background: #005eb8; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;`;
        btn.onclick = runExtraction;
        document.body.appendChild(btn);
    }

    async function runExtraction() {
        const btn = document.getElementById('xjtu-grade-btn');
        const oldText = btn.innerHTML;

        btn.innerHTML = "🆔 验证身份...";
        btn.disabled = true;

        const studentId = await getStudentId();

        let rtMap = {};
        if (studentId) {
            btn.innerHTML = "📡 同步实时总分...";
            rtMap = await fetchGradesFromIframe(studentId);
        } else {
            alert("无法获取学号，请检查登录状态。");
        }

        btn.innerHTML = oldText;
        btn.disabled = false;

        const tbody = document.querySelector(TABLE_ID + " > tbody");
        if (!tbody) { alert("表格未找到"); return; }

        let tableHtml = `
            <div style="font-family: 'Microsoft YaHei', sans-serif;">
                <div style="margin-bottom: 10px; display: flex; justify-content: space-between;">
                    <h3 style="margin:0; color: #fff;">
                        详细成绩单
                        ${Object.keys(rtMap).length > 0 ? `<span style="color:#4caf50;font-size:0.6em">[已同步]</span>` : ''}
                    </h3>
                    <button id="close-grade-table" style="background: #ff4d4d; color: white; border: none; padding: 5px 10px; cursor: pointer;">关闭</button>
                </div>
                <div style="max-height: 600px; overflow-y: auto;">
                    <table border="1" style="width: 100%; border-collapse: collapse; color: #eee; text-align: center;">
                        <thead style="background: #2c2c2c; position: sticky; top: 0;">
                            <tr>${columns.map(col => `<th style="padding: 10px;">${col.show}</th>`).join("")}</tr>
                        </thead>
                        <tbody>
        `;

        tbody.querySelectorAll("tr").forEach(row => {
            const tds = row.querySelectorAll("td");
            const courseNameTd = tds[2];
            const courseName = courseNameTd ? (courseNameTd.querySelector("span")?.title || courseNameTd.innerText).trim() : "";

            const realTimeScore = rtMap[courseName];

            tableHtml += "<tr style='background: #1e1e1e;'>";
            columns.forEach(col => {
                let value = "-";

                // === 逻辑核心 ===
                if (col.name === "总成绩") {
                    if (realTimeScore) {
                        // 绿色：报表里的新分
                        value = `<b style="color: #4caf50;">${realTimeScore}</b>`;
                    } else if (tds[col.index]) {
                        // 白色：网页里的旧分
                        value = tds[col.index].innerText.trim();
                    }
                }
                else {
                    // 平时分等：DOM直读 (保持细节不丢)
                    if (tds[col.index]) {
                         value = tds[col.index].querySelector("span")?.title || tds[col.index].innerText.trim();
                    }
                }

                tableHtml += `<td style="padding: 8px; border: 1px solid #444;">${value}</td>`;
            });
            tableHtml += "</tr>";
        });

        tableHtml += "</tbody></table></div></div>";

        const oldDiv = document.getElementById("extracted-grade-table");
        if(oldDiv) oldDiv.remove();

        const div = document.createElement("div");
        div.id = "extracted-grade-table";
        div.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: #121212; padding: 20px; border-radius: 8px; border: 1px solid #333; min-width: 950px;`;
        div.innerHTML = tableHtml;
        document.body.appendChild(div);
        document.getElementById("close-grade-table").onclick = () => div.remove();
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector(TABLE_ID) && !document.getElementById('xjtu-grade-btn')) createButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();