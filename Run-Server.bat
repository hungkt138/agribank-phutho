@echo off
chcp 65001 > nul
title AGRIBANK CHI NHÁNH PHÚ THỌ - PORTAL SERVER
echo ==========================================================================
echo  ĐANG KHỞI CHẠY CỔNG QUẢN TRỊ & TIỆN ÍCH HỒ SƠ AGRIBANK CHI NHÁNH PHÚ THỌ
echo ==========================================================================
echo  Địa chỉ trên máy này: http://localhost:8888
echo  Vui lòng không đóng cửa sổ này trong quá trình làm việc.
echo ==========================================================================
python server.py
pause
