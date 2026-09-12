/* ==========================================================================
   AGRIBANK CHI NHÁNH PHÚ THỌ - HARDWARE INTEGRATION MODULE
   Camera, QR Scanner, Bluetooth Thermal Printer & A4 Direct Print Engine
   ========================================================================== */

const HardwareManager = {
  html5QrCodeScanner: null,
  activeVideoStream: null,
  bluetoothDevice: null,
  bluetoothCharacteristic: null,

  // Initialize Web Camera QR Scanner
  async startQrScanner(elementId, onScanSuccessCallback) {
    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('Thư viện Html5Qrcode chưa được tải!');
    }

    if (this.html5QrCodeScanner) {
      await this.stopQrScanner();
    }

    this.html5QrCodeScanner = new Html5Qrcode(elementId);
    const config = { fps: 15, qrbox: { width: 260, height: 260 } };

    try {
      await this.html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          this.parseAndTriggerCccdData(decodedText, onScanSuccessCallback);
        },
        (errorMessage) => {
          // Silent scan frame errors
        }
      );
    } catch (err) {
      console.warn("Unable to start back camera, trying default device...", err);
      // Fallback to default device
      await this.html5QrCodeScanner.start(
        { facingMode: "user" },
        config,
        (decodedText, decodedResult) => {
          this.parseAndTriggerCccdData(decodedText, onScanSuccessCallback);
        }
      );
    }
  },

  async stopQrScanner() {
    if (this.html5QrCodeScanner) {
      try {
        await this.html5QrCodeScanner.stop();
        this.html5QrCodeScanner.clear();
      } catch (e) {
        console.warn('Scanner stop error:', e);
      }
      this.html5QrCodeScanner = null;
    }
  },

  // Parse Standard Vietnamese CCCD QR Code Data Format
  // Format: CCCD_ID|CMND_Old|Full_Name|DOB(DDMMYYYY)|Gender|Address|Issue_Date(DDMMYYYY)
  parseCccdQr(rawText) {
    if (!rawText) return null;
    const parts = rawText.split('|');
    if (parts.length >= 6) {
      const formatDob = (str) => str && str.length === 8 ? `${str.substring(0,2)}/${str.substring(2,4)}/${str.substring(4,8)}` : str;
      const formatIssueDate = (str) => str && str.length === 8 ? `${str.substring(0,2)}/${str.substring(2,4)}/${str.substring(4,8)}` : str;

      return {
        cccd: parts[0] ? parts[0].trim() : '',
        cmndOld: parts[1] ? parts[1].trim() : '',
        fullName: parts[2] ? parts[2].trim() : '',
        dob: formatDob(parts[3] ? parts[3].trim() : ''),
        gender: parts[4] ? parts[4].trim() : '',
        address: parts[5] ? parts[5].trim() : '',
        issueDate: formatIssueDate(parts[6] ? parts[6].trim() : ''),
        scannedAt: new Date().toLocaleString('vi-VN'),
        raw: rawText
      };
    }
    return null;
  },

  parseAndTriggerCccdData(rawText, callback) {
    const data = this.parseCccdQr(rawText);
    if (data) {
      if (window.AuditManager) {
        AuditManager.log('QUÉT QR CCCD', `Cán bộ thực hiện quét CCCD: ${data.fullName} - ${data.cccd.substring(0, 3)}***`);
      }
      if (callback) callback(data);
    } else {
      console.warn("Unrecognized QR string format:", rawText);
    }
  },

  // Camera Live Portrait / Document Snapshot Capture
  async startCameraFeed(videoElementId) {
    try {
      const videoEl = document.getElementById(videoElementId);
      if (!videoEl) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoEl.srcObject = stream;
      videoEl.play();
      this.activeVideoStream = stream;
    } catch (err) {
      alert("Không thể kết nối Camera: " + err.message);
    }
  },

  stopCameraFeed() {
    if (this.activeVideoStream) {
      this.activeVideoStream.getTracks().forEach(track => track.stop());
      this.activeVideoStream = null;
    }
  },

  captureSnapshot(videoElementId, canvasElementId) {
    const video = document.getElementById(videoElementId);
    const canvas = document.getElementById(canvasElementId);
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  },

  // Web Bluetooth Thermal Printer Connection
  async connectBluetoothPrinter() {
    if (!navigator.bluetooth) {
      throw new Error("Trình duyệt không hỗ trợ Web Bluetooth API! Vui lòng dùng Google Chrome / MS Edge.");
    }

    try {
      this.bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
      });

      const server = await this.bluetoothDevice.gatt.connect();
      const services = await server.getPrimaryServices();
      if (services.length > 0) {
        const characteristics = await services[0].getCharacteristics();
        if (characteristics.length > 0) {
          this.bluetoothCharacteristic = characteristics[0];
        }
      }

      if (window.AuditManager) {
        AuditManager.log('KẾT NỐI MÁY IN', `Đã kết nối thành công với Máy in Bluetooth: ${this.bluetoothDevice.name || 'Printer'}`);
      }

      return this.bluetoothDevice.name || 'Bluetooth Printer';
    } catch (err) {
      console.error("Bluetooth connection failed:", err);
      throw err;
    }
  },

  // Print Receipt Ticket on Bluetooth Thermal Printer
  async printThermalTicket(customerData) {
    if (!this.bluetoothCharacteristic) {
      // Fallback: Show print preview modal
      this.triggerDirectA4Print();
      return;
    }

    const text = `
--------------------------------
 AGRIBANK CHI NHÁNH PHÚ THỌ
   PHIẾU TẢI & IN HỒ SƠ
--------------------------------
Khách hàng: ${customerData.fullName}
Số CCCD: ${customerData.cccd}
Ngày sinh: ${customerData.dob}
Địa chỉ: ${customerData.address}
Thời gian: ${new Date().toLocaleString('vi-VN')}
Trạng thái: Đã kiểm tra hồ sơ
--------------------------------
  CẢM ƠN QUÝ KHÁCH ĐÃ SỬ DỤNG
    DỊCH VỤ CỦA AGRIBANK!
\n\n\n`;

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.bluetoothCharacteristic.writeValue(data);
  },

  // Direct High-Speed A4 Printing Engine
  triggerDirectA4Print(documentHtml) {
    if (documentHtml) {
      let printContainer = document.getElementById('print-area-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'print-area-container';
        printContainer.className = 'print-only';
        document.body.appendChild(printContainer);
      }
      printContainer.innerHTML = documentHtml;
    }

    if (window.AuditManager && window.AuthManager) {
      const user = AuthManager.getCurrentUser();
      AuditManager.log('IN HỒ SƠ', `Cán bộ ${user ? user.fullName : ''} ra lệnh xuất in hồ sơ trực tiếp.`);
    }

    window.print();
  }
};

window.HardwareManager = HardwareManager;
