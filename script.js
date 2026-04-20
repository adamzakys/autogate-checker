const GAS_URL = "https://script.google.com/macros/s/AKfycbwB-nJtBPjV8TEfwwX8-GvnmDOBg4RKfmepKVa1qETK6TWVoGUbZX5D_Cf2IKSvdfIVwg/exec";
const hardwareGroups = [
    { name: "Barrier Unit", id: "barrier", items: [{ id: "palang", label: "Palang" }, { id: "obs", label: "Sensor OBS" }, { id: "loop", label: "Sensor Loop" }, { id: "motor", label: "Motor & Gearbox" }, { id: "psu", label: "PSU Barrier" }] },
    { name: "Panel Manless", id: "manless", items: [{ id: "mcb", label: "MCB Utama" }, { id: "scanner", label: "Scanner/RFID" }, { id: "network_switch", label: "Network Switch" }, { id: "controller", label: "Controller" }, { id: "power_supply", label: "Power Supply" }, { id: "wiring", label: "Kabel & Wiring" }] },
    { name: "Sistem Kamera", id: "kamera", items: [{ id: "lpr", label: "Kamera LPR" }, { id: "ocr", label: "Kamera OCR" }] },
    { name: "Indikator Visual", id: "visual", items: [{ id: "traffic_light", label: "Traffic Light" }, { id: "cross_arrow", label: "Cross Arrow" }, { id: "running_text", label: "Running Text" }] }
];

let currentUser = ""; let currentGate = "";
let selectedPhotos = []; let globalHistory = {}; 

document.addEventListener("DOMContentLoaded", () => {
    renderFormUI();
    populateMaintenanceDropdown();
    fetchMasterData();
});

function populateMaintenanceDropdown() {
    const sel = document.getElementById("maint-komponen");
    sel.innerHTML = `<option value="">-- Hanya Catatan (Tidak pilih alat) --</option>`;
    hardwareGroups.forEach(g => {
        let optGroup = document.createElement("optgroup");
        optGroup.label = g.name;
        g.items.forEach(i => {
            let opt = document.createElement("option");
            opt.value = i.id; opt.innerText = i.label;
            optGroup.appendChild(opt);
        });
        sel.appendChild(optGroup);
    });
}

function fetchMasterData() {
    fetch(GAS_URL).then(res => res.json()).then(data => {
        if (data.status === "success") {
            const offSelect = document.getElementById("select-officer");
            const gateSelect = document.getElementById("select-gate");
            data.officers.forEach(o => offSelect.add(new Option(o, o)));
            data.gates.forEach(g => gateSelect.add(new Option(g, g)));
            
            globalHistory = data.history || {}; 
            document.getElementById("loadingOverlay").classList.add("hidden");
            
            const savedUser = localStorage.getItem("preventive_user");
            const savedTab = localStorage.getItem("preventive_tab") || "dashboard";
            if (savedUser) {
                currentUser = savedUser;
                document.getElementById("select-officer").value = currentUser;
                document.getElementById("user-greeting").innerText = `Halo, ${currentUser}`;
                document.getElementById("view-login").classList.add("hidden");
                document.getElementById("view-main").classList.remove("hidden");
                document.getElementById("view-main").classList.add("flex");
                switchTab(savedTab);
            } else { document.getElementById("view-login").classList.remove("hidden"); }
        }
    }).catch(err => {
        Swal.fire({ icon: 'error', title: 'Gagal Memuat', text: 'Koneksi server bermasalah.', confirmButtonColor: '#eb3c21' });
        document.getElementById("loadingText").innerText = "Gagal memuat. Refresh halaman.";
    });
}

function loginUser() {
    const officer = document.getElementById("select-officer").value;
    if (!officer) return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih nama Anda!', confirmButtonColor: '#eb3c21' });
    currentUser = officer;
    localStorage.setItem("preventive_user", currentUser); localStorage.setItem("preventive_tab", "dashboard");
    document.getElementById("user-greeting").innerText = `Halo, ${currentUser}`;
    document.getElementById("view-login").classList.add("hidden");
    document.getElementById("view-main").classList.remove("hidden");
    document.getElementById("view-main").classList.add("flex");
}

function logoutUser() {
    Swal.fire({ title: 'Keluar?', text: "Anda harus memilih ulang Officer.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#eb3c21', cancelButtonColor: '#94a3b8', confirmButtonText: 'Ya, Keluar'
    }).then((res) => {
        if (res.isConfirmed) {
            localStorage.removeItem("preventive_user"); localStorage.removeItem("preventive_tab");
            window.location.reload();
        }
    });
}

function switchTab(tabName) {
    // Reset Photos Array every tab switch so it doesn't mix
    selectedPhotos = []; renderPhotoList('daily'); renderPhotoList('maintenance');

    const tabs = ['dashboard', 'checker', 'maintenance'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== tabName);
        let nav = document.getElementById(`nav-${t}`);
        if(t === 'maintenance') {
             nav.className = t === tabName ? "flex-1 py-3 pt-4 flex flex-col items-center text-blue-600 transition-colors" : "flex-1 py-3 pt-4 flex flex-col items-center text-slate-400 hover:text-blue-600 transition-colors";
        } else {
             nav.className = t === tabName ? "flex-1 py-3 pt-4 flex flex-col items-center text-primary transition-colors" : "flex-1 py-3 pt-4 flex flex-col items-center text-slate-400 hover:text-primary transition-colors";
        }
    });
    document.getElementById("main-content").scrollTop = 0;
    if(currentUser) localStorage.setItem("preventive_tab", tabName);
}

function loadGateStatus() {
    currentGate = document.getElementById("select-gate").value;
    const panel = document.getElementById("gate-status-panel");
    const list = document.getElementById("status-list");
    
    document.getElementById("active-gate-text-checker").innerText = currentGate || "Pilih gate di Dashboard";
    document.getElementById("active-gate-text-maint").innerText = currentGate || "Pilih gate di Dashboard";

    if (!currentGate) { panel.classList.add("hidden"); return; }
    document.getElementById("active-gate-badge").innerText = currentGate;
    panel.classList.remove("hidden");

    const historyData = globalHistory[currentGate];
    if (!historyData) {
        list.innerHTML = `<p class="text-[11px] text-slate-500 font-medium p-4 text-center bg-slate-100 rounded-xl border border-slate-200">Belum ada riwayat pengecekan.</p>`;
        return;
    }

    let htmlContent = "";
    historyData.forEach((item, index) => {
        if (item.status === "Normal") {
            htmlContent += `
                <div onclick="showHistoryDetail('${currentGate}', ${index})" class="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer hover:bg-green-100 transition">
                    <div class="bg-green-100 p-1.5 rounded-full"><svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>
                    <div class="flex-1"><p class="text-[13px] font-bold text-green-800 tracking-wide">Semua Perangkat Aman</p><p class="text-[10px] text-green-600 font-medium mt-1">${item.tanggal}</p></div>
                </div>`;
        } else {
            const isRusak = item.status === "Rusak/Error";
            const badgeColor = isRusak ? "bg-red-100 text-red-600 border-red-200" : "bg-yellow-100 text-yellow-600 border-yellow-200";
            const borderColor = isRusak ? "border-l-red-500" : "border-l-yellow-400";
            htmlContent += `
                <div onclick="showHistoryDetail('${currentGate}', ${index})" class="bg-white border-l-[5px] ${borderColor} p-3.5 rounded-xl shadow-sm border-y border-r border-slate-200 flex flex-col gap-2 cursor-pointer hover:bg-slate-50 transition relative">
                    <div class="flex justify-between items-center pr-4"><span class="font-bold text-slate-700 text-[13px]">${item.komponen}</span><span class="${badgeColor} border px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide">${item.status}</span></div>
                    <div class="flex items-center gap-2 mt-1 flex-wrap"><span class="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">📍 ${currentGate}</span><span class="text-[10px] text-slate-400 font-medium">${item.tanggal}</span></div>
                </div>`;
        }
    });
    list.innerHTML = htmlContent;
}

function showHistoryDetail(gate, index) {
    const item = globalHistory[gate][index];
    let fotoHtml = '';
    if (item.foto && item.foto.trim() !== '' && item.foto !== 'undefined') {
        const urls = item.foto.split(','); fotoHtml = '<div class="flex gap-2 mt-3 overflow-x-auto pb-2">';
        urls.forEach(url => { if(url.trim() !== '') { fotoHtml += `<a href="${url.trim()}" target="_blank" class="shrink-0 bg-primary_light text-primary text-[10px] font-bold py-1.5 px-3 rounded-md border border-primary/20 shadow-sm">Lihat Lampiran</a>`; }});
        fotoHtml += '</div>';
    } else { fotoHtml = '<p class="text-[10px] text-slate-400 mt-2 italic border-t border-slate-200 pt-2">Tidak ada foto dilampirkan.</p>'; }
    const cat = (item.catatan && item.catatan !== 'undefined') ? item.catatan : "Tidak ada catatan khusus.";

    Swal.fire({
        title: 'Detail Pengecekan',
        html: `<div class="text-left text-sm mt-2 border-t border-slate-100 pt-4"><div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-50"><span class="text-slate-500 font-medium">Komponen:</span><strong class="text-slate-800">${item.komponen}</strong></div><div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-50"><span class="text-slate-500 font-medium">Waktu:</span><strong class="text-slate-800 text-[11px] bg-slate-100 px-2 py-1 rounded border border-slate-200">${item.tanggal}</strong></div><div class="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm"><p class="text-xs font-bold text-slate-600 mb-1">Catatan Petugas:</p><p class="text-[13px] text-slate-700 leading-relaxed">${cat}</p>${fotoHtml}</div></div>`,
        confirmButtonColor: '#eb3c21', confirmButtonText: 'Tutup'
    });
}

function renderFormUI() {
    const container = document.getElementById("dynamic-form-container");
    let html = "";
    hardwareGroups.forEach(group => {
        html += `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"><div class="bg-slate-50/50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3"><h2 class="font-bold text-[13px] uppercase tracking-wide text-slate-800 flex items-center gap-2"><div class="w-1.5 h-4 bg-primary rounded-full"></div>${group.name}</h2><div class="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm text-xs font-bold w-full sm:w-auto"><span class="px-3 py-2 bg-slate-100 text-slate-500 border-r border-slate-200 flex-1 text-center">SET ALL</span><button type="button" onclick="setAllGroup('${group.id}', 'Normal')" class="px-3 py-2 hover:bg-green-100 text-green-600 border-r border-slate-200 flex-1">N</button><button type="button" onclick="setAllGroup('${group.id}', 'Peringatan')" class="px-3 py-2 hover:bg-yellow-100 text-yellow-500 border-r border-slate-200 flex-1">P</button><button type="button" onclick="setAllGroup('${group.id}', 'Rusak/Error')" class="px-3 py-2 hover:bg-red-100 text-red-500 flex-1">R</button></div></div><div class="p-4 space-y-4">`;
        group.items.forEach(item => {
            html += `<div class="flex flex-col border-b border-slate-100 pb-3 last:border-0 last:pb-0"><span class="text-xs font-bold text-slate-700 mb-2">${item.label}</span><div class="flex space-x-2"><label class="flex-1 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-green-50 border border-slate-200 rounded-xl p-2 transition-colors has-[:checked]:bg-green-50 has-[:checked]:border-green-500 has-[:checked]:shadow-sm"><input type="radio" name="${item.id}" value="Normal" class="group-${group.id} mb-1 !accent-green-600" required><span class="text-[10px] font-bold text-slate-600">Normal</span></label><label class="flex-1 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-yellow-50 border border-slate-200 rounded-xl p-2 transition-colors has-[:checked]:bg-yellow-50 has-[:checked]:border-yellow-400 has-[:checked]:shadow-sm"><input type="radio" name="${item.id}" value="Peringatan" class="group-${group.id} mb-1 !accent-yellow-500"><span class="text-[10px] font-bold text-slate-600">Warning</span></label><label class="flex-1 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-xl p-2 transition-colors has-[:checked]:bg-red-50 has-[:checked]:border-red-500 has-[:checked]:shadow-sm"><input type="radio" name="${item.id}" value="Rusak/Error" class="group-${group.id} mb-1 !accent-red-600"><span class="text-[10px] font-bold text-slate-600">Rusak</span></label></div></div>`;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
}

function setAllGroup(groupId, statusValue) {
    document.querySelectorAll(`.group-${groupId}`).forEach(radio => { if (radio.value === statusValue) radio.checked = true; });
}

function triggerPhotoInput() { document.getElementById('hidden-photo-input').click(); }

function handlePhotoSelection(event, type='daily') {
    const files = event.target.files;
    if (files.length > 0) {
        for(let i = 0; i < files.length; i++) { selectedPhotos.push(files[i]); }
        renderPhotoList(type);
    }
    event.target.value = ''; 
}

function renderPhotoList(type) {
    const containerId = type === 'maintenance' ? 'maint-photo-list' : 'photo-list-container';
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = "";
    selectedPhotos.forEach((file, index) => {
        container.innerHTML += `<div class="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl"><div class="flex items-center gap-3 overflow-hidden"><div class="bg-primary_light text-primary p-1.5 rounded-lg"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div><span class="text-xs font-medium text-slate-700 truncate">${file.name}</span></div><button type="button" onclick="removePhoto(${index}, '${type}')" class="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></div>`;
    });
}

function removePhoto(index, type) { selectedPhotos.splice(index, 1); renderPhotoList(type); }

function showHelp() {
    Swal.fire({
        title: 'Pusat Bantuan', html: '<p class="text-sm text-slate-600 mb-2">Aplikasi Daily Preventive Autogate.</p><p class="text-xs text-slate-500">Jika ada kendala sistem, hubungi tim pengembang ~ Adam Zaky.</p>',
        icon: 'info', showCancelButton: true, showDenyButton: true, confirmButtonColor: '#eb3c21', cancelButtonColor: '#e2e8f0', denyButtonColor: '#334155',
        cancelButtonText: '<span class="text-slate-700">Tutup</span>', confirmButtonText: 'Hubungi IT', denyButtonText: 'Reset', reverseButtons: true
    }).then((res) => {
        if (res.isConfirmed) { window.open('https://wa.me/6283129939682', '_blank');
        } else if (res.isDenied) {
            document.getElementById("loadingText").innerText = "Membersihkan Cache..."; document.getElementById("loadingOverlay").classList.remove("hidden");
            window.location.href = window.location.href.split('?')[0] + '?v=' + new Date().getTime();
        }
    });
}

// FUNGSI KOMPRESI FOTO MENGGUNAKAN CANVAS (Mencegah Drive Penuh)
async function fileToCompressedBase64(file, gateName, officerName) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // --- WATERMARK LENGKAP ---
                const now = new Date();
                const timestamp = now.toLocaleString('id-ID');
                // Teks: "Gate 01 | Zaky | 20/04/2026 11:30"
                const watermarkText = `${gateName} | ${officerName} | ${timestamp}`;
                
                // Background teks agar terbaca di foto terang/gelap
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, height - 40, width, 40);

                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText(watermarkText, width / 2, height - 15);

                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}


async function submitForm(e, formType) {
    e.preventDefault();
    if (!currentGate) return Swal.fire({icon: 'warning', title: 'Tunggu!', text: 'Pilih Gate...'});

    // Teks loading diganti, tidak ada lagi kata "Lokasi"
    document.getElementById("loadingText").innerText = "Memproses Foto...";
    document.getElementById("loadingOverlay").classList.remove("hidden");

    // --- PASTIKAN TIDAK ADA BARIS await getCurrentLocation() DI SINI ---

    const now = new Date();
    const tgl = ("0" + now.getDate()).slice(-2) + "/" + ("0" + (now.getMonth() + 1)).slice(-2) + "/" + now.getFullYear().toString().substr(-2);
    const wkt = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);

    const payload = { 
        type: formType, 
        tanggal: tgl, 
        waktu: wkt, 
        gate: currentGate, 
        officer: currentUser 
    };

    if(formType === 'daily') {
        let hardwareData = {};
        hardwareGroups.forEach(g => { g.items.forEach(i => {
            const sel = document.querySelector(`input[name="${i.id}"]:checked`);
            hardwareData[i.id] = sel ? sel.value : "";
        });});
        payload.hardware = hardwareData;
        payload.keterangan = document.getElementById("input-keterangan").value;
    } else {
        const selectKomp = document.getElementById("maint-komponen");
        payload.maint_komponen = selectKomp.value;
        payload.maint_komponen_label = selectKomp.options[selectKomp.selectedIndex].text;
        payload.maint_status = document.getElementById("maint-status").value;
        payload.keterangan = document.getElementById("maint-keterangan").value;
    }

    // Bagian kompresi foto yang sering bikin berat jika spek HP rendah
    let photosArray = [];
    if (selectedPhotos.length > 0) {
        for (let file of selectedPhotos) {
            // Kita panggil watermark dengan data yang sudah ada di memori (cepat)
            const base64Data = await fileToCompressedBase64(file, currentGate, currentUser); 
            photosArray.push({ 
                filename: file.name, 
                mimeType: "image/jpeg", 
                base64: base64Data.split(',')[1] 
            });
        }
    }
    payload.photos = photosArray;

    // Langsung tembak ke GAS
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(result => {
            document.getElementById("loadingOverlay").classList.add("hidden");
            if (result.status === "success") {
                Swal.fire({icon: 'success', title: 'Berhasil!'}).then(() => {
                    location.reload(); 
                });
            }
        }).catch(err => {
            document.getElementById("loadingOverlay").classList.add("hidden");
            Swal.fire({icon: 'error', title: 'Gagal', text: 'Cek koneksi internet.'});
        });
}


// Mencegah Klik Kanan
document.addEventListener('contextmenu', event => event.preventDefault());

// Mencegah Shortcut Inspect Element (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
document.onkeydown = function(e) {
    if (e.keyCode == 123 || 
        (e.ctrlKey && e.shiftKey && (e.keyCode == 'I'.charCodeAt(0) || e.keyCode == 'J'.charCodeAt(0))) || 
        (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0))) {
        return false;
    }
};