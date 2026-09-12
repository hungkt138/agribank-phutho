/* ==========================================================================
   AGRIBANK CHI NHÁNH PHÚ THỌ - AUTHENTICATION & SECURITY MODULE
   ========================================================================== */

const AuthManager = {
  STORAGE_USERS_KEY: 'agribank_users_v1',
  STORAGE_SESSION_KEY: 'agribank_session_v1',
  INACTIVITY_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes auto-lock
  inactivityTimer: null,

  // Helper: SHA-256 Password Hash
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_AGRIBANK_PHUTHO_SALT_2026");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Initialize Default System Users if not present
  async init() {
    let users = this.getUsers();
    if (!users || users.length === 0) {
      const defaultAdminPass = await this.hashPassword('admin123');
      const defaultOfficerPass = await this.hashPassword('123456');

      users = [
        {
          id: 'USR001',
          username: 'admin',
          fullName: 'Nguyễn Văn Quản Trị',
          code: 'AGR-PT-001',
          role: 'ADMIN', // ADMIN, OFFICER, SUPERVISOR
          unit: 'Trụ sở Chi nhánh Phú Thọ',
          phone: '0912345678',
          passwordHash: defaultAdminPass,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: 'USR002',
          username: 'canbo01',
          fullName: 'Trần Thị Mai',
          code: 'AGR-HV-088',
          role: 'OFFICER',
          unit: 'PGD Hùng Vương',
          phone: '0988776655',
          passwordHash: defaultOfficerPass,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: 'USR003',
          username: 'canbo02',
          fullName: 'Lê Hoàng Nam',
          code: 'AGR-VT-099',
          role: 'OFFICER',
          unit: 'PGD Việt Trì',
          phone: '0977112233',
          passwordHash: defaultOfficerPass,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: 'USR004',
          username: 'kiemsoat01',
          fullName: 'Phạm Đức Kiểm',
          code: 'AGR-KS-005',
          role: 'SUPERVISOR',
          unit: 'Phòng Kiểm tra Kiểm soát Nội bộ',
          phone: '0903456789',
          passwordHash: defaultOfficerPass,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        }
      ];
      this.saveUsers(users);
    }

    this.resetInactivityTimer();
    this.bindInactivityListeners();
  },

  getUsers() {
    try {
      const data = localStorage.getItem(this.STORAGE_USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading users:', e);
      return [];
    }
  },

  saveUsers(users) {
    localStorage.setItem(this.STORAGE_USERS_KEY, JSON.stringify(users));
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.STORAGE_SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  async login(username, password) {
    const users = this.getUsers();
    const hash = await this.hashPassword(password);
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());

    if (!user) {
      throw new Error('Tài khoản không tồn tại trên hệ thống!');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Quản trị viên!');
    }

    if (user.passwordHash !== hash) {
      throw new Error('Mật khẩu không chính xác!');
    }

    const sessionData = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      code: user.code,
      role: user.role,
      unit: user.unit,
      loginAt: new Date().toISOString(),
      token: 'AGR_TOKEN_' + Math.random().toString(36).substring(2)
    };

    localStorage.setItem(this.STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    this.resetInactivityTimer();
    
    // Audit log
    if (window.AuditManager) {
      AuditManager.log('ĐĂNG NHẬP', `Cán bộ ${user.fullName} (${user.code}) đăng nhập thành công.`);
    }

    return sessionData;
  },

  logout() {
    const user = this.getCurrentUser();
    if (user && window.AuditManager) {
      AuditManager.log('ĐĂNG XUẤT', `Cán bộ ${user.fullName} đăng xuất khỏi hệ thống.`);
    }
    localStorage.removeItem(this.STORAGE_SESSION_KEY);
    window.location.reload();
  },

  lockScreen() {
    const user = this.getCurrentUser();
    if (user) {
      const lockOverlay = document.getElementById('lock-screen-modal');
      if (lockOverlay) {
        document.getElementById('lock-username').innerText = user.fullName;
        document.getElementById('lock-unit').innerText = user.unit;
        lockOverlay.style.display = 'flex';
      }
    }
  },

  async unlockScreen(password) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const users = this.getUsers();
    const found = users.find(u => u.id === user.id);
    if (!found) return false;

    const hash = await this.hashPassword(password);
    if (found.passwordHash === hash) {
      document.getElementById('lock-screen-modal').style.display = 'none';
      this.resetInactivityTimer();
      return true;
    }
    return false;
  },

  bindInactivityListeners() {
    const events = ['mousemove', 'keypress', 'click', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, () => this.resetInactivityTimer());
    });
  },

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (this.getCurrentUser()) {
        this.lockScreen();
      }
    }, this.INACTIVITY_TIMEOUT_MS);
  },

  // Role permissions helpers
  hasRole(role) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true; // Admin has all permissions
    return currentUser.role === role;
  },

  canManageUsers() {
    return this.hasRole('ADMIN');
  },

  canUnmaskData() {
    const currentUser = this.getCurrentUser();
    return currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR');
  }
};

window.AuthManager = AuthManager;
