# Raspberry Pi Desktop Integration Checklist (With External Monitor)

Dahil may external monitor ka na, mas padadaliin natin! Pwede mong gamitin ang Raspberry Pi mo na parang normal na minicomputer (ikakabit mo lang yung keyboard at mouse).

### 🔌 Phase 1: Preparing the Memory Card (Sa Laptop Mo)
- [ ] **Download Raspberry Pi Imager**: Mag-download at install ng [Raspberry Pi Imager](https://www.raspberrypi.com/software/) sa laptop mo.
- [ ] **Flash OS**: Buksan ang Imager. 
    1. Select OS -> 'Raspberry Pi OS (32-bit o 64-bit)'. 
    2. Select Storage -> Piliin yung Memory Card mo.
- [ ] **⚙️ Imager Settings (Gear icon / Ctrl+Shift+X)**: Pangpadali lang ng buhay:
    - [ ] Set username and password (Halimbawa: username: `pi`, password: `raspberry`)
    - [ ] Configure wireless LAN (Ilagay ang Wi-Fi details mo)
    - [ ] Set locale settings (Timezone: Asia/Manila).
- [ ] **Write**: I-click ang "Save" tapos "WRITE". Hintaying matapos.

### 🛠️ Phase 2: Hardware Assembly
- [ ] I-connect ang **Raspberry Pi Camera Module 2** sa "CAMERA" ribbon port ng Raspberry Pi (Yung "blue" part ng cable nakatalikod sa camera lens/nakaharap sa Ethernet port).
- [ ] Ipasok ang Memory Card sa Raspberry Pi.
- [ ] I-connect ang **External Monitor** mo (gamit yung Micro-HDMI adapter to HDMI cable papunta sa TV/Monitor).
- [ ] I-connect ang USB Keyboard at Mouse sa Raspberry Pi.
- [ ] Pang-huli, isaksak ang Power Supply (USB-C) ng Pi para bumukas ito!

### 💻 Phase 3: Desktop Setup at Enabling The Ports
Kapag nag-boot up na ang Raspberry Pi at nakikita mo na ang Desktop home screen s'ya (parang Windows):
- [ ] Mag-log in kung hinihingi ang username at password.
- [ ] Connect mo sa Wi-Fi kung hindi pa siya connected (Yung Wi-Fi icon sa upper right corner ng screen).
- [ ] **Enable Ports**: Buksan ang "Terminal" app (Yung black icon sa taas) at i-type: `sudo raspi-config`
  - [ ] Punta ka sa **Interface Options > Camera** -> Enable ito.
  - [ ] Punta ka sa **Interface Options > Serial Port** -> Tatanungin kung gusto mo ng "login shell over serial" (i-`No`), tapos "enable serial port hardware" (i-`Yes`). Kailangan ito pra makausap ang UHF-RFID mo!
  - [ ] Exit at i-restart ang Raspberry Pi (`sudo reboot`).

### 📸 Phase 4: Camera Check & Testing (Dito na tayo mag-cco-code)
Kapag nag-restart na at nag-load ulit ang desktop ng Pi:
- [ ] Buksan ang Terminal ulit at i-test ang Pi Camera module mo para makita natin kung tama ang kabit ng ribbon!
- [ ] I-type: `libcamera-hello` (Kung Raspberry Pi OS Bullseye/Bookworm gamit mo) o `raspistill -v -o test.jpg` (kung older OS). Dapat mag-bukas ang window preview at makikita mo ang view ng camera mo sa loob ng 5 seconds.

Kung successful yung Camera Check, sabihan mo ako at ituturo ko ang code para mabasa naman natin yung mga tags galing sa **UHF-RFID** mo (i-reready na rin natin yung Python environment sa loob ng Pi para dyan tatakbo yung AI scanning natin)!
