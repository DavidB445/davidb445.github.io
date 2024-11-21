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

function displayParsedData(binData) {
    const sectorTableBody = document.getElementById('sectorTable').querySelector('tbody');
    sectorTableBody.innerHTML = ''; // Clear previous results

    // Extract Block 0 information
    const uid = Array.from(binData.slice(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    const manufacturerData = binData.slice(4, 16);
    const manufacturerInfo = Array.from(manufacturerData).map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

    // Display UID and Manufacturer Data
    document.getElementById('info').innerHTML = `
        <p><strong>UID:</strong> ${uid}</p>
        <p><strong>Manufacturer Data:</strong> ${manufacturerInfo}</p>
    `;

    // Parse sectors and access conditions
    let blockIndex = 0;

    for (let sector = 0; blockIndex < binData.length; sector++) {
        const isBigSector = sector >= 32; // Big sectors have 16 blocks
        const blocksInSector = isBigSector ? 16 : 4;
        const trailerBlock = blockIndex + blocksInSector - 1;

        const keyA = Array.from(binData.slice(trailerBlock * 16, trailerBlock * 16 + 6))
            .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

        const accessBits = binData.slice(trailerBlock * 16 + 6, trailerBlock * 16 + 10);
        const accessConditions = decodeAccessBits(accessBits);

        const keyB = Array.from(binData.slice(trailerBlock * 16 + 10, trailerBlock * 16 + 16))
            .map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

        // Add to table
        const row = sectorTableBody.insertRow();
        row.innerHTML = `
            <td>${sector}</td>
            <td>${keyA}</td>
            <td>${keyB}</td>
            <td>${Array.from(accessBits).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}</td>
            <td>${accessConditions}</td>
        `;

        blockIndex += blocksInSector;
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
