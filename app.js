/* ==========================================================================
   AGRIBANK CHI NHÁNH PHÚ THỌ - MAIN APP CONTROLLER & AUDIT LOGS
   ========================================================================== */

// 1. AUDIT LOGGING ENGINE
const AuditManager = {
  STORAGE_KEY: 'agribank_audit_logs_v1',

  getLogs() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  log(actionType, details) {
    const logs = this.getLogs();
    const currentUser = window.AuthManager ? AuthManager.getCurrentUser() : null;

    const newLog = {
      id: 'LOG_' + Date.now(),
      timestamp: new Date().toLocaleString('vi-VN'),
      officerName: currentUser ? currentUser.fullName : 'Hệ thống',
      officerCode: currentUser ? currentUser.code : 'SYS',
      unit: currentUser ? currentUser.unit : 'Trụ sở Chi nhánh Phú Thọ',
      actionType: actionType, // ĐĂNG NHẬP, QUÉT QR, IN HỒ SƠ, XUẤT WORD, BẢO MẬT, QUẢN TRỊ
      details: details
    };

    logs.unshift(newLog); // Newest log first
    if (logs.length > 500) logs.pop(); // Keep last 500 logs
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));

    // Refresh log table if currently on audit tab
    if (window.AppController && AppController.currentTab === 'audit-tab') {
      AppController.renderAuditLogs();
    }
  },

  clearLogs() {
    if (AuthManager.hasRole('ADMIN')) {
      localStorage.removeItem(this.STORAGE_KEY);
      this.log('XÓA LOG', 'Quản trị viên đã dọn dẹp nhật ký hệ thống.');
    }
  }
};
window.AuditManager = AuditManager;

// 2. CUSTOMER RECORDS ENGINE
const CustomerManager = {
  STORAGE_KEY: 'agribank_customer_records_v1',

  getRecords() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveRecords(records) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  },

  addOrUpdateRecord(data) {
    const records = this.getRecords();
    const index = records.findIndex(r => r.cccd === data.cccd);
    const currentUser = AuthManager.getCurrentUser();

    const record = {
      ...data,
      phone: data.phone || '',
      cif: data.cif || '',
      status: data.status || 'Đã quét CCCD',
      updatedAt: new Date().toLocaleString('vi-VN'),
      officerName: currentUser ? currentUser.fullName : 'Cán bộ Agribank'
    };

    if (index >= 0) {
      records[index] = { ...records[index], ...record };
    } else {
      record.id = 'REC_' + Date.now();
      record.createdAt = new Date().toLocaleString('vi-VN');
      records.unshift(record);
    }

    this.saveRecords(records);
    return record;
  },

  deleteRecord(id) {
    let records = this.getRecords();
    const target = records.find(r => r.id === id);
    records = records.filter(r => r.id !== id);
    this.saveRecords(records);
    if (target && window.AuditManager) {
      AuditManager.log('XÓA HỒ SƠ', `Đã xóa hồ sơ khách hàng: ${target.fullName} (${target.cccd})`);
    }
  },

  maskData(str, showStart = 3, showEnd = 3) {
    if (!str) return '';
    if (str.length <= showStart + showEnd) return '***';
    return str.substring(0, showStart) + '***' + str.substring(str.length - showEnd);
  }
};
window.CustomerManager = CustomerManager;

// 3. MAIN APP CONTROLLER
const AppController = {
  currentTab: 'scanner-tab',
  isDataUnmasked: false,
  activeRecordForPrint: null,

  init() {
    // Check Authentication state
    const user = AuthManager.getCurrentUser();
    if (!user) {
      document.getElementById('login-screen-modal').style.display = 'flex';
      return;
    } else {
      document.getElementById('login-screen-modal').style.display = 'none';
      this.updateUserUI(user);
    }

    // Mobile Hamburger Menu Listener
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Bind navigation tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
        if (sidebar) sidebar.classList.remove('open'); // Close mobile menu after selecting tab
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nextTheme);
        themeBtn.innerHTML = nextTheme === 'light' ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
        lucide.createIcons();
      });
    }

    // Render initial views
    this.renderCustomerRecords();
    this.renderUserManagement();
    this.renderTemplatesManagement();
    this.renderAuditLogs();
    this.updateStats();

    // Role-based visibility
    if (!AuthManager.canManageUsers()) {
      const userTabBtn = document.querySelector('[data-tab="users-tab"]');
      const templatesTabBtn = document.querySelector('[data-tab="templates-tab"]');
      if (userTabBtn) userTabBtn.style.display = 'none';
      if (templatesTabBtn) templatesTabBtn.style.display = 'none';
    }
  },

  updateUserUI(user) {
    document.getElementById('nav-user-name').innerText = user.fullName;
    document.getElementById('nav-user-role').innerText = user.role === 'ADMIN' ? 'Quản trị viên' : (user.role === 'SUPERVISOR' ? 'Kiểm soát' : 'Cán bộ');
    document.getElementById('nav-user-unit').innerText = user.unit;
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === tabId) {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    if (tabId === 'records-tab') this.renderCustomerRecords();
    if (tabId === 'users-tab') this.renderUserManagement();
    if (tabId === 'templates-tab') this.renderTemplatesManagement();
    if (tabId === 'audit-tab') this.renderAuditLogs();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Customer Records Renderer
  renderCustomerRecords() {
    const tbody = document.getElementById('customer-table-body');
    if (!tbody) return;

    const records = CustomerManager.getRecords();
    const canUnmask = AuthManager.canUnmaskData();

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu hồ sơ nào. Hãy bấm <strong>Quét QR CCCD</strong> hoặc <strong>Quét Mẫu (Test)</strong> để tạo hồ sơ mới!</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const displayCccd = (this.isDataUnmasked && canUnmask) ? r.cccd : CustomerManager.maskData(r.cccd, 3, 3);
      const displayPhone = (this.isDataUnmasked && canUnmask) ? (r.phone || 'Chưa cập nhật') : CustomerManager.maskData(r.phone, 3, 3);

      return `
        <tr>
          <td><strong>${i + 1}</strong></td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${r.fullName}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${r.address || ''}</div>
          </td>
          <td><span class="masked-data">${displayCccd}</span></td>
          <td>${r.dob}</td>
          <td>${r.gender}</td>
          <td>${displayPhone}</td>
          <td><span class="badge badge-success">${r.status}</span></td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-primary btn-sm" onclick="AppController.openPrintPreviewModal('${r.id}')" title="Xuất & In Hồ Sơ">
                <i data-lucide="printer"></i> In
              </button>
              <button class="btn btn-secondary btn-sm" onclick="AppController.exportWordForRecord('${r.id}')" title="Tải file Word (.doc)">
                <i data-lucide="file-text"></i> Word
              </button>
              <button class="btn btn-danger btn-sm" onclick="AppController.deleteRecord('${r.id}')" title="Xóa">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Document Templates Management Renderer (For Admins)
  renderTemplatesManagement() {
    const tbody = document.getElementById('templates-table-body');
    if (!tbody) return;

    const templates = TemplateManager.getTemplates();
    tbody.innerHTML = templates.map((t, i) => `
      <tr>
        <td><strong>${i + 1}</strong></td>
        <td><code style="color: var(--agri-gold); font-weight: bold;">${t.code}</code></td>
        <td>
          <div style="font-weight: 700;">${t.title}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${t.description || ''}</div>
        </td>
        <td><span class="badge badge-info">${t.category}</span></td>
        <td><span class="badge badge-success">${t.status}</span></td>
        <td>${t.updatedAt}</td>
        <td>
          <div style="display: flex; gap: 0.3rem;">
            <button class="btn btn-secondary btn-sm" onclick="AppController.openEditTemplateModal('${t.id}')">
              <i data-lucide="edit-3"></i> Sửa
            </button>
            <button class="btn btn-danger btn-sm" onclick="AppController.deleteTemplate('${t.id}')">
              <i data-lucide="trash-2"></i> Xóa
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  openEditTemplateModal(templateId) {
    const templates = TemplateManager.getTemplates();
    const tpl = templates.find(t => t.id === templateId);

    document.getElementById('edit-tpl-id').value = tpl ? tpl.id : '';
    document.getElementById('edit-tpl-code').value = tpl ? tpl.code : 'AGR-BM04';
    document.getElementById('edit-tpl-title').value = tpl ? tpl.title : '';
    document.getElementById('edit-tpl-category').value = tpl ? tpl.category : 'Tài khoản & Thẻ';
    document.getElementById('edit-tpl-desc').value = tpl ? tpl.description : '';

    this.openModal('edit-template-modal');
  },

  saveTemplateForm() {
    const id = document.getElementById('edit-tpl-id').value;
    const code = document.getElementById('edit-tpl-code').value.trim();
    const title = document.getElementById('edit-tpl-title').value.trim();
    const category = document.getElementById('edit-tpl-category').value;
    const description = document.getElementById('edit-tpl-desc').value.trim();

    if (!code || !title) {
      alert("Vui lòng nhập đầy đủ Mã biểu mẫu và Tên biểu mẫu!");
      return;
    }

    TemplateManager.addOrUpdateTemplate({
      id: id || undefined,
      code,
      title,
      category,
      description,
      status: 'ACTIVE'
    });

    this.renderTemplatesManagement();
    this.closeModal('edit-template-modal');
    alert("Đã cập nhật danh mục mẫu hồ sơ thành công!");
  },

  deleteTemplate(templateId) {
    if (confirm("Bạn có chắc chắn muốn xóa biểu mẫu này khỏi hệ thống?")) {
      TemplateManager.deleteTemplate(templateId);
      this.renderTemplatesManagement();
    }
  },

  // Toggle Sensitive Data Masking
  toggleDataUnmask() {
    if (!AuthManager.canUnmaskData()) {
      alert("Bạn không có quyền xem đầy đủ thông tin nhạy cảm của khách hàng!");
      return;
    }
    this.isDataUnmasked = !this.isDataUnmasked;
    const btn = document.getElementById('toggle-unmask-btn');
    if (btn) {
      btn.innerHTML = this.isDataUnmasked ? '<i data-lucide="eye-off"></i> Ẩn dữ liệu nhạy cảm' : '<i data-lucide="eye"></i> Mở khóa xem đầy đủ';
    }
    AuditManager.log('BẢO MẬT DỮ LIỆU', `Cán bộ ${AuthManager.getCurrentUser().fullName} đã ${this.isDataUnmasked ? 'mở khóa xem đầy đủ' : 'ẩn'} dữ liệu CCCD/SĐT khách hàng.`);
    this.renderCustomerRecords();
  },

  // User Management Renderer (For Admins)
  renderUserManagement() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const users = AuthManager.getUsers();
    tbody.innerHTML = users.map((u, i) => `
      <tr>
        <td><strong>${i + 1}</strong></td>
        <td>
          <div style="font-weight: 700;">${u.fullName}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${u.code}</div>
        </td>
        <td><code style="color: var(--agri-gold);">${u.username}</code></td>
        <td><span class="badge ${u.role === 'ADMIN' ? 'badge-danger' : (u.role === 'SUPERVISOR' ? 'badge-warning' : 'badge-info')}">${u.role}</span></td>
        <td>${u.unit}</td>
        <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="AppController.toggleUserStatus('${u.id}')">
            ${u.status === 'ACTIVE' ? 'Khóa TK' : 'Mở Khóa'}
          </button>
        </td>
      </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // System Audit Log Renderer
  renderAuditLogs() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    const logs = AuditManager.getLogs();
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có nhật ký ghi nhận.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${l.timestamp}</td>
        <td><strong>${l.officerName}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${l.officerCode})</span></td>
        <td><span class="badge badge-info">${l.actionType}</span></td>
        <td>${l.details}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${l.unit}</td>
      </tr>
    `).join('');
  },

  updateStats() {
    const records = CustomerManager.getRecords();
    const users = AuthManager.getUsers();

    const statRecordsEl = document.getElementById('stat-total-records');
    const statUsersEl = document.getElementById('stat-total-users');
    if (statRecordsEl) statRecordsEl.innerText = records.length;
    if (statUsersEl) statUsersEl.innerText = users.length;
  },

  runSampleScan() {
    const samples = [
      "025095001234|131888999|NGUYỄN VĂN AN|15101995|Nam|Khu 4, Phường Gia Cẩm, TP Việt Trì, Phú Thọ|20052021",
      "025188009876|131555444|TRAN THI BICH NGOC|08041992|Nữ|Thị trấn Phong Châu, Huyện Phù Ninh, Phú Thọ|12102022",
      "025078005566|131222111|PHẠM HÙNG CƯỜNG|22121988|Nam|Phường Hùng Vương, Thị xã Phú Thọ, Phú Thọ|05062020"
    ];
    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    const parsed = HardwareManager.parseCccdQr(randomSample);
    if (parsed) {
      CustomerManager.addOrUpdateRecord(parsed);
      this.renderCustomerRecords();
      this.updateStats();
      alert(`[QUÉT THÀNH CÔNG]\nĐã nhập hồ sơ khách hàng: ${parsed.fullName}\nSố CCCD: ${parsed.cccd}`);
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  },

  openPrintPreviewModal(recordId) {
    const records = CustomerManager.getRecords();
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    this.activeRecordForPrint = record;
    const previewContainer = document.getElementById('print-preview-body');
    if (previewContainer) {
      previewContainer.innerHTML = TemplateManager.generateAccountOpeningFormHtml(record);
    }
    this.openModal('print-preview-modal');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
    HardwareManager.stopQrScanner();
    HardwareManager.stopCameraFeed();
  },

  printActivePreview() {
    if (this.activeRecordForPrint) {
      const html = TemplateManager.generateAccountOpeningFormHtml(this.activeRecordForPrint);
      HardwareManager.triggerDirectA4Print(html);
    }
  },

  exportWordForRecord(recordId) {
    const records = CustomerManager.getRecords();
    const record = records.find(r => r.id === recordId);
    if (record) {
      TemplateManager.exportSingleDocx(record);
    }
  },

  deleteRecord(recordId) {
    if (confirm("Bạn có chắc chắn muốn xóa hồ sơ khách hàng này khỏi hệ thống?")) {
      CustomerManager.deleteRecord(recordId);
      this.renderCustomerRecords();
      this.updateStats();
    }
  },

  toggleUserStatus(userId) {
    if (!AuthManager.canManageUsers()) return;
    const users = AuthManager.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.status = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
      AuthManager.saveUsers(users);
      AuditManager.log('QUẢN TRỊ NGƯỜI DÙNG', `Đã ${user.status === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản cán bộ: ${user.fullName}`);
      this.renderUserManagement();
    }
  }
};

window.AppController = AppController;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await AuthManager.init();
  AppController.init();
});
