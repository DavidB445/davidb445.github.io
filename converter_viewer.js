document.getElementById('convertButton').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file!');
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        const text = reader.result;
        const lines = text.split('\n');
        const binData = [];

        // Extract hex data and build .bin file
        for (const line of lines) {
            if (line.startsWith('Block')) {
                const hexData = line.split(':')[1].trim();
                const bytes = hexData.split(' ').map(byte => parseInt(byte, 16));
                binData.push(...bytes);
            }
        }

        if (binData.length === 0) {
            alert('No block data found in the file.');
            return;
        }

        // Create a .bin file for download
        const blob = new Blob([new Uint8Array(binData)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'output.bin';
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download BIN File';

        // Parse and display data
        displayParsedData(binData);
    };

    reader.readAsText(file);
});

// Manufacturer lookup table
const manufacturerLookup = {
    "00": "Unknown or Reserved",
    "04": "NXP Semiconductors",
    "05": "Mikron",
    "07": "Infineon Technologies",
    "0A": "Atmel",
    "0B": "SLE (Siemens/Infineon)",
    "0C": "HITAG (Philips/NXP)",
    "0F": "NXP (former Philips Semiconductors)",
    "11": "STMicroelectronics",
    "13": "Toshiba",
    "1F": "Broadcom",
    "2B": "Intel Corporation",
    "2E": "Sony Corporation",
    "39": "Motorola",
    "3F": "Microchip Technology",
    "41": "ASK (Amplitude Shift Keying)",
    "43": "Melexis",
    "4A": "EM Microelectronic-Marin SA",
    "4D": "Micron",
    "55": "Magellan Technology",
    "6A": "Samsung",
    "7C": "Toshiba",
    "88": "Shanghai Fudan Microelectronics",
    "8A": "Texas Instruments",
    "A0": "EMVCo (Payment Systems)",
    "A1": "LEGIC Identsystems AG",
    "B0": "Giesecke+Devrient",
    "B3": "Samsung Electronics",
    "C0": "RFID Components",
    "C1": "Silicon Craft Technology",
    "C2": "Zilog",
    "D2": "Shanghai Huahong Integrated Circuit",
    "E0": "SMARTRAC (now Avery Dennison RFID)",
    "E1": "TagSys",
    "F0": "Feitian Technologies",
    "FF": "Test Manufacturer/Custom Chip",
};


function displayParsedData(binData) {
    const sectorTableBody = document.getElementById('sectorTable').querySelector('tbody');
    sectorTableBody.innerHTML = ''; // Clear previous results

    // Extract Block 0 information
    const uid = Array.from(binData.slice(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    const bcc = binData[4];
    const manufacturerCode = binData[5].toString(16).padStart(2, '0').toUpperCase();
    const productionYear = 2000 + ((binData[6] & 0xF0) >> 4); // Upper 5 bits
    const productionWeek = binData[6] & 0x0F; // Lower 5 bits

    // Manufacturer name lookup
    const manufacturerName = manufacturerLookup[manufacturerCode] || "Unknown Manufacturer";

    // Validate and possibly calculate BCC
    const bccResult = validateBCC(binData.slice(0, 4), bcc);

    // Display UID and Manufacturer Data
    document.getElementById('info').innerHTML = `
        <p><strong>UID:</strong> ${uid}</p>
        <p><strong>BCC:</strong> ${bcc.toString(16).padStart(2, '0').toUpperCase()} 
           (Valid: ${bccResult.isValid ? "Yes" : "No"}${!bccResult.isValid ? `, Valid BCC: ${bccResult.calculatedBCC}` : ''})</p>
        <p><strong>Manufacturer Code:</strong> ${manufacturerCode} (${manufacturerName})</p>
        <p><strong>Production Year:</strong> ${productionYear}</p>
        <p><strong>Production Week:</strong> ${productionWeek}</p>
    `;

    // Parse sectors and display
    parseSectors(binData, sectorTableBody);
}

function validateBCC(uid, bcc) {
    // Calculate the valid BCC by XOR-ing the 4 UID bytes
    const calculatedBCC = uid[0] ^ uid[1] ^ uid[2] ^ uid[3];
    
    // Check if the provided BCC matches the calculated BCC
    const isValid = calculatedBCC === bcc;
    
    // If invalid, return the calculated BCC value
    if (!isValid) {
        return { isValid: false, calculatedBCC: calculatedBCC.toString(16).padStart(2, '0').toUpperCase() };
    }

    // If valid, return true
    return { isValid: true };
}

function parseSectors(binData, sectorTableBody) {
    let blockIndex = 0;
    let sectorCount = 0;
    const totalBlocks = binData.length / 16;  // Total number of blocks in the file

    // Mifare Classic 1K and 4K cards both have 4 blocks per sector
    const blocksPerSector = 4;

    // Check if the card is 1K or 4K
    const is1KCard = totalBlocks === 64;  // Mifare Classic 1K
    const is4KCard = totalBlocks === 256;  // Mifare Classic 4K

    if (!is1KCard && !is4KCard) {
        console.error("Unsupported card type or invalid card size.");
        return;
    }

    while (blockIndex < totalBlocks) {
        if (sectorCount < 32) {
            // For sectors 0-31 (4 blocks per sector)
            const trailerBlock = blockIndex + blocksPerSector - 1;

            const keyA = Array.from(binData.slice(trailerBlock * 16, trailerBlock * 16 + 6))
                .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

            const accessBits = binData.slice(trailerBlock * 16 + 6, trailerBlock * 16 + 10);
            const accessConditions = decodeAccessBits(accessBits);

            const keyB = Array.from(binData.slice(trailerBlock * 16 + 10, trailerBlock * 16 + 16))
                .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

            const row = sectorTableBody.insertRow();
            row.innerHTML = `
                <td>${sectorCount}</td>
                <td>${keyA}</td>
                <td>${keyB}</td>
                <td>${Array.from(accessBits).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}</td>
                <td>${accessConditions}</td>
            `;

            blockIndex += blocksPerSector;  // Move to next sector
        } else {
            // For sectors 32-39 (8 blocks per sector)
            const trailerBlock = blockIndex + 8 - 1;  // Last block of the sector

            const keyA = Array.from(binData.slice(trailerBlock * 16, trailerBlock * 16 + 6))
                .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

            const accessBits = binData.slice(trailerBlock * 16 + 6, trailerBlock * 16 + 10);
            const accessConditions = decodeAccessBits(accessBits);

            const keyB = Array.from(binData.slice(trailerBlock * 16 + 10, trailerBlock * 16 + 16))
                .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

            const row = sectorTableBody.insertRow();
            row.innerHTML = `
                <td>${sectorCount}</td>
                <td>${keyA}</td>
                <td>${keyB}</td>
                <td>${Array.from(accessBits).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}</td>
                <td>${accessConditions}</td>
            `;

            blockIndex += 8;  // Move to next sector
        }

        sectorCount++;
    }
}


function decodeAccessBits(accessBits) {
    // Decode access bits based on Mifare Classic specification
    const bits = Array.from(accessBits).map(b => b.toString(2).padStart(8, '0')).join('');
    const c1 = bits.slice(0, 3);
    const c2 = bits.slice(4, 7);
    const c3 = bits.slice(8, 11);

    // Simplified decoding
    return `
        Read: ${c1}, Write: ${c2}, Increment/Decrement: ${c3}
    `;
}
