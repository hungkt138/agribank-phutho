/* ==========================================================================
   AGRIBANK CHI NHÁNH PHÚ THỌ - DOCUMENT GENERATION & TEMPLATE ENGINE
   ========================================================================== */

const TemplateManager = {
  STORAGE_KEY: 'agribank_templates_v1',

  // Default Document Templates List (Managed by Admin)
  getDefaultTemplates() {
    return [
      {
        id: 'TPL001',
        code: 'AGR-BM01',
        title: 'Giấy đề nghị mở tài khoản & sử dụng dịch vụ KH Cá nhân',
        category: 'Tài khoản & Thẻ',
        status: 'ACTIVE',
        updatedAt: new Date().toLocaleDateString('vi-VN'),
        description: 'Biểu mẫu chuẩn mở tài khoản thanh toán VND, dịch vụ Agribank E-Mobile Banking và thẻ ATM.'
      },
      {
        id: 'TPL002',
        code: 'AGR-BM02',
        title: 'Tờ khai đăng ký dịch vụ Agribank E-Mobile Banking & OTT',
        category: 'Ngân hàng số',
        status: 'ACTIVE',
        updatedAt: new Date().toLocaleDateString('vi-VN'),
        description: 'Mẫu đăng ký dịch vụ Ngân hàng số và nhận thông báo biến động số dư OTT Alert.'
      },
      {
        id: 'TPL003',
        code: 'AGR-BM03',
        title: 'Phiếu cập nhật thông tin hồ sơ & thay đổi thông tin KH',
        category: 'Hồ sơ Khách hàng',
        status: 'ACTIVE',
        updatedAt: new Date().toLocaleDateString('vi-VN'),
        description: 'Mẫu cập nhật thông tin CCCD gắn chip mới cho khách hàng cá nhân.'
      }
    ];
  },

  getTemplates() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : this.getDefaultTemplates();
    } catch (e) {
      return this.getDefaultTemplates();
    }
  },

  saveTemplates(templates) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
  },

  addOrUpdateTemplate(data) {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === data.id);

    const template = {
      ...data,
      updatedAt: new Date().toLocaleDateString('vi-VN')
    };

    if (index >= 0) {
      templates[index] = template;
    } else {
      template.id = 'TPL_' + Date.now();
      templates.unshift(template);
    }

    this.saveTemplates(templates);

    if (window.AuditManager && window.AuthManager) {
      const user = AuthManager.getCurrentUser();
      AuditManager.log('QUẢN TRỊ BIỂU MẪU', `Cán bộ Admin ${user ? user.fullName : ''} đã cập nhật mẫu hồ sơ: ${template.title} (${template.code})`);
    }

    return template;
  },

  deleteTemplate(id) {
    let templates = this.getTemplates();
    const target = templates.find(t => t.id === id);
    templates = templates.filter(t => t.id !== id);
    this.saveTemplates(templates);

    if (target && window.AuditManager) {
      AuditManager.log('XÓA BIỂU MẪU', `Đã xóa biểu mẫu hồ sơ: ${target.title}`);
    }
  },

  // Generate HTML for Agribank A4 Print Form 01: Giấy mở tài khoản & dịch vụ
  generateAccountOpeningFormHtml(data, templateCode = 'AGR-BM01') {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const templates = this.getTemplates();
    const activeTpl = templates.find(t => t.code === templateCode) || templates[0];

    return `
      <div class="a4-page">
        <div class="a4-header" style="text-align: center; border-bottom: 2px solid #8B0000; padding-bottom: 12px; margin-bottom: 20px;">
          <p style="font-size: 11pt; font-weight: bold; margin-bottom: 2px;">NGÂN HÀNG NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN VIỆT NAM (AGRIBANK)</p>
          <p style="font-size: 11pt; font-weight: bold; color: #006838; margin-bottom: 10px;">CHI NHÁNH PHÚ THỌ</p>
          <h2 style="margin-top: 10px; color: #8B0000; font-size: 15pt; font-weight: bold;">${activeTpl.title.toUpperCase()}</h2>
          <p style="font-size: 10pt; font-style: italic; color: #555;">(Mã biểu mẫu: ${activeTpl.code})</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p><strong>Kính gửi:</strong> Ngân hàng Agribank Chi nhánh Phú Thọ / Phòng Giao dịch Hùng Vương</p>
        </div>

        <fieldset style="border: 1px solid #8B0000; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <legend style="color: #8B0000; font-weight: bold; padding: 0 8px;">I. THÔNG TIN KHÁCH HÀNG (Bóc tách từ CCCD gắn chip)</legend>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
            <tr>
              <td style="padding: 5px 0; width: 32%;"><strong>Họ và tên khách hàng:</strong></td>
              <td style="padding: 5px 0; font-size: 13pt; font-weight: bold; color: #000;">${(data.fullName || '').toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Số CCCD gắn chip:</strong></td>
              <td style="padding: 5px 0; font-weight: bold;">${data.cccd || ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Số CMND cũ:</strong></td>
              <td style="padding: 5px 0;">${data.cmndOld || 'Không có'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Ngày sinh:</strong></td>
              <td style="padding: 5px 0;">${data.dob || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Giới tính:</strong> ${data.gender || ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Địa chỉ thường trú:</strong></td>
              <td style="padding: 5px 0;">${data.address || ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Số điện thoại:</strong></td>
              <td style="padding: 5px 0;">${data.phone || '........................................................'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Số CIF:</strong></td>
              <td style="padding: 5px 0;">${data.cif || 'Tạo mới'}</td>
            </tr>
          </table>
        </fieldset>

        <fieldset style="border: 1px solid #006838; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
          <legend style="color: #006838; font-weight: bold; padding: 0 8px;">II. ĐĂNG KÝ DỊCH VỤ VỚI AGRIBANK</legend>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px;">
            <div>☑ <strong>Tài khoản thanh toán VND</strong></div>
            <div>☑ <strong>Dịch vụ Agribank E-Mobile Banking</strong></div>
            <div>☑ <strong>Dịch vụ SMS Banking / OTT Alert</strong></div>
            <div>☑ <strong>Mở Thẻ ghi nợ nội địa / Quốc tế</strong></div>
            <div>☑ <strong>Tài khoản số đẹp Agribank</strong></div>
            <div>☑ <strong>Cập nhật thông tin CCCD mới</strong></div>
          </div>
        </fieldset>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; text-align: center;">
          <div style="width: 45%;">
            <p><strong>XÁC NHẬN CỦA AGRIBANK CN PHÚ THỌ</strong></p>
            <p><em>(Ký, đóng dấu & ghi rõ họ tên)</em></p>
            <br><br><br>
            <p><strong>CÁN BỘ TIẾP NHẬN HỒ SƠ</strong></p>
          </div>
          <div style="width: 45%;">
            <p><em>Phú Thọ, Ngày ${day} tháng ${month} năm ${year}</em></p>
            <p><strong>KHÁCH HÀNG ĐỀ NGHỊ</strong></p>
            <p><em>(Ký và ghi rõ họ tên)</em></p>
            <br><br><br>
            <p><strong>${(data.fullName || '').toUpperCase()}</strong></p>
          </div>
        </div>
      </div>
    `;
  },

  // Export Customer List to Excel (.xlsx) using SheetJS
  exportToExcel(customerList, filename = 'Danh_Sach_Ho_So_Agribank_PhuTho.xlsx') {
    if (typeof XLSX === 'undefined') {
      alert("Thư viện SheetJS (XLSX) chưa sẵn sàng!");
      return;
    }

    const excelData = customerList.map((item, index) => ({
      "STT": index + 1,
      "Họ và Tên": item.fullName,
      "Số CCCD": item.cccd,
      "Số CMND Cũ": item.cmndOld || '',
      "Ngày Sinh": item.dob,
      "Giới Tính": item.gender,
      "Địa Chỉ Thường Trú": item.address,
      "Số Điện Thoại": item.phone || '',
      "Số CIF": item.cif || '',
      "Ngày Quét Hồ Sơ": item.scannedAt || '',
      "Cán Bộ Xử Lý": item.officerName || 'Hệ thống'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hồ sơ Agribank");
    XLSX.writeFile(workbook, filename);

    if (window.AuditManager) {
      AuditManager.log('XUẤT EXCEL', `Đã xuất ${customerList.length} hồ sơ khách hàng ra file Excel.`);
    }
  },

  // Export Single Document to Word (.doc/.docx)
  exportSingleDocx(customerData, templateCode = 'AGR-BM01') {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Ho so Agribank Phu Tho</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; }
          h2 { color: #8B0000; text-align: center; font-size: 15pt; text-transform: uppercase; }
        </style>
      </head>
      <body>
        ${this.generateAccountOpeningFormHtml(customerData, templateCode)}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });

    const fileName = `Agribank_PhuTho_${(customerData.fullName || 'KhachHang').replace(/\s+/g, '_')}_${customerData.cccd || ''}.doc`;
    saveAs(blob, fileName);

    if (window.AuditManager && window.AuthManager) {
      const user = AuthManager.getCurrentUser();
      AuditManager.log('XUẤT FILE WORD', `Cán bộ ${user ? user.fullName : ''} đã xuất file hồ sơ Word cho KH: ${customerData.fullName}.`);
    }
  }
};

window.TemplateManager = TemplateManager;
