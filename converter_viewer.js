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

    // Check if the card is 1K or 4K
    const is1KCard = totalBlocks === 64;  // Mifare Classic 1K
    const is4KCard = totalBlocks === 256;  // Mifare Classic 4K

    if (!is1KCard && !is4KCard) {
        console.error("Unsupported card type or invalid card size.");
        return;
    }

    // Loop through sectors
    while (blockIndex < totalBlocks) {
        let blocksPerSector;

        // Handle sectors 0-31: 4 blocks per sector
        if (sectorCount < 32) {
            blocksPerSector = 4;
        }
        // Handle sectors 32-39: 16 blocks per sector (only for 4K cards)
        else if (sectorCount >= 32 && sectorCount < 40) {
            blocksPerSector = 16;
        } else {
            // Beyond sector 39, skip any extra sectors for 4K cards
            break;
        }

        // Ensure we don't process out-of-bounds data
        if (blockIndex + blocksPerSector > totalBlocks) {
            break;
        }

        // Extract the sector trailer block (last block in the sector)
        const trailerBlock = blockIndex + blocksPerSector - 1;

        // Extract key and access information
        const keyA = Array.from(binData.slice(trailerBlock * 16, trailerBlock * 16 + 6))
            .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

        const accessBits = binData.slice(trailerBlock * 16 + 6, trailerBlock * 16 + 9);  // Only 3 bytes for access conditions
        const accessConditions = decodeAccessBits(accessBits);


        const keyB = Array.from(binData.slice(trailerBlock * 16 + 10, trailerBlock * 16 + 16))
            .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

        // Add the sector information to the table
        const row = sectorTableBody.insertRow();
        row.innerHTML = `
            <td>${sectorCount}</td>
            <td>${keyA}</td>
            <td>${keyB}</td>
            <td>${Array.from(accessBits).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}</td>
            <td>${accessConditions}</td>
        `;

        blockIndex += blocksPerSector;  // Move to the next sector
        sectorCount++;  // Increment sector number
    }
}

function decodeAccessBits(accessBits) {
    // Ensure we're decoding exactly 3 bytes (24 bits)
    const bits = Array.from(accessBits)
        .map(b => b.toString(2).padStart(8, '0'))  // Convert each byte to binary and pad to 8 bits
        .join('');

    // Extract read, write, and increment/decrement permission bits
    const readBits = bits.slice(0, 3);
    const writeBits = bits.slice(3, 6);
    const incDecBits = bits.slice(6, 9);

    // Define access conditions for each permission group
    const accessConditions = {
        read: {
            "000": "No access",
            "001": "Always accessible",
            "010": "Accessible with Key A",
            "011": "Accessible with Key B",
            "100": "Read access without authentication",
            "101": "Accessible with either Key A or Key B",
        },
        write: {
            "000": "No access",
            "001": "Always accessible",
            "010": "Accessible with Key A",
            "011": "Accessible with Key B",
            "100": "Write access without authentication",
            "101": "Accessible with either Key A or Key B",
        },
        increment: {
            "000": "No access",
            "001": "Always accessible",
            "010": "Accessible with Key A",
            "011": "Accessible with Key B",
            "100": "Increment/Decrement without authentication",
            "101": "Accessible with either Key A or Key B",
        },
    };

    // Get the human-readable access rights
    const readAccess = accessConditions.read[readBits] || "Invalid";
    const writeAccess = accessConditions.write[writeBits] || "Invalid";
    const incDecAccess = accessConditions.increment[incDecBits] || "Invalid";

    // Return the decoded access rights
    return `
        Read: ${readAccess}, Write: ${writeAccess}, Increment/Decrement: ${incDecAccess}
    `;
}

