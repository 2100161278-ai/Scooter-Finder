document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scan-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const radar = document.getElementById('radar');
    const deviceNameEl = document.getElementById('device-name');
    const statusMessageEl = document.getElementById('status-message');
    const distanceDisplayEl = document.getElementById('distance-display');
    const signalContainer = document.getElementById('signal-container');
    const scooterIcon = document.getElementById('scooter-icon');
    const toast = document.getElementById('toast');

    let bluetoothDevice = null;
    let scanInterval = null;

    // Show a toast message
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    };

    // Check if Web Bluetooth API is supported or if we are in a secure context
    let isSimulator = false;
    if (!navigator.bluetooth || !window.isSecureContext) {
        statusMessageEl.textContent = "提示: 当前为本地浏览不支持蓝牙调用，已开启模拟演示模式！";
        showToast("已为你开启模拟演示模式");
        isSimulator = true;
    }

    scanBtn.addEventListener('click', async () => {
        if (isSimulator) {
            simulateConnection();
            return;
        }

        try {
            statusMessageEl.textContent = "正在请求蓝牙设备...";
            radar.classList.add('scanning');
            
            // Request device
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['generic_access'] // Good practice for BLE compatibility
            });

            // Once paired or selected
            statusMessageEl.textContent = "正在连接 " + (bluetoothDevice.name || "未知设备") + "...";
            deviceNameEl.textContent = bluetoothDevice.name || "我的电动车";
            
            // Listen for disconnections
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

            // Connect to the GATT server
            const server = await bluetoothDevice.gatt.connect();
            
            statusMessageEl.textContent = "连接成功！正在监控信号...";
            scanBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
            signalContainer.classList.add('active');

            // Set up RSSI monitoring
            if ('watchAdvertisements' in bluetoothDevice) {
                try {
                    bluetoothDevice.addEventListener('advertisementreceived', handleAdvertisement);
                    await bluetoothDevice.watchAdvertisements();
                    statusMessageEl.textContent = "正在追踪真实蓝牙信号强度...";
                } catch (error) {
                    console.log("watchAdvertisements failed:", error);
                    startSimulatedMonitoring();
                }
            } else {
                startSimulatedMonitoring();
            }

        } catch (error) {
            console.error(error);
            if (error.name === 'NotFoundError') {
                statusMessageEl.textContent = "未找到设备或已取消选择。";
            } else {
                statusMessageEl.textContent = "连接失败: " + error.message;
                showToast(error.message);
            }
            radar.classList.remove('scanning');
        }
    });

    async function simulateConnection() {
        statusMessageEl.textContent = "正在搜索附近的电动车 (模拟)...";
        radar.classList.add('scanning');
        
        // 模拟等待 2 秒钟
        await new Promise(r => setTimeout(r, 2000));
        
        deviceNameEl.textContent = "小牛电动车 (演示)";
        statusMessageEl.textContent = "已连接！正在估算距离...";
        
        scanBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        signalContainer.classList.add('active');
        
        startSimulatedMonitoring();
    }

    disconnectBtn.addEventListener('click', () => {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
        } else {
            // If in simulation mode
            onDisconnected();
        }
    });

    function onDisconnected() {
        statusMessageEl.textContent = "Device disconnected.";
        deviceNameEl.textContent = "Not Connected";
        radar.classList.remove('scanning');
        scanBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        signalContainer.classList.remove('active');
        signalContainer.className = 'signal-indicator'; // Reset levels
        distanceDisplayEl.textContent = "-- m";
        scooterIcon.style.transform = `translate(0px, 0px) scale(1)`;
        
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
    }

    function handleAdvertisement(event) {
        const rssi = event.rssi;
        updateUIWithRSSI(rssi);
    }
    
    function startSimulatedMonitoring() {
        // Fallback for demonstration when watchAdvertisements is unavailable
        let currentRssi = -90; // Start far away
        
        statusMessageEl.textContent = "Tracking distance...";
        
        scanInterval = setInterval(() => {
            // Random walk for RSSI to simulate moving around
            currentRssi += (Math.random() * 8 - 3); // Bias slightly towards getting closer
            if (currentRssi > -35) currentRssi = -35;
            if (currentRssi < -100) currentRssi = -100;
            
            updateUIWithRSSI(currentRssi);
        }, 1200);
    }

    function updateUIWithRSSI(rssi) {
        // Calculate abstract distance based on RSSI
        // Math representation: distance = 10 ^ ((Measured Power - RSSI) / (10 * N))
        // Assuming Measured Power at 1m is -50dBm and environmental factor N is 2.5
        let distance = Math.pow(10, ((-50 - rssi) / (10 * 2.5)));
        
        // Update text
        if (distance > 50) {
            distanceDisplayEl.textContent = "> 50 m";
        } else if (distance < 0.5) {
            distanceDisplayEl.textContent = "< 0.5 m";
        } else {
            distanceDisplayEl.textContent = distance.toFixed(1) + " m";
        }
        
        // Update Signal Bars
        signalContainer.className = 'signal-indicator active';
        let level = 1;
        if (rssi > -60) level = 4;
        else if (rssi > -75) level = 3;
        else if (rssi > -88) level = 2;
        
        signalContainer.classList.add('level-' + level);

        // Animate scooter icon closer/further from center based on RSSI
        // Max radius for icon movement is ~100px from center
        const maxRadius = 100;
        
        // Normalize RSSI between 0 and 1, where -100 is 0 (far) and -35 is 1 (close)
        const normalize = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));
        const closeness = normalize(rssi, -100, -35); 
        
        const currentRadius = maxRadius * (1 - closeness);
        
        // Generate a random angle so it "wanders" slightly
        const time = Date.now() / 1000;
        const speed = 0.5;
        // Lissajous curve for smooth wandering
        const angle = time * speed; 
        
        const x = Math.sin(angle) * currentRadius * 0.8 + Math.cos(angle * 0.7) * currentRadius * 0.2;
        const y = Math.cos(angle * 1.2) * currentRadius * 0.8 + Math.sin(angle * 0.5) * currentRadius * 0.2;
        
        const scale = 0.8 + (closeness * 0.4); // Scale between 0.8 and 1.2
        
        // Apply transform
        scooterIcon.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
});
