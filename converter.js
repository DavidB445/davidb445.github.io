document.getElementById('convertButton').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file!');
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        const lines = reader.result.split('\n');
        const binData = [];

        // Extract hex data from lines starting with "Block"
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

        // Convert the binData array to a Blob
        const blob = new Blob([new Uint8Array(binData)], { type: 'application/octet-stream' });

        // Create a downloadable link
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'output.bin';
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download BIN File';
    };

    reader.readAsText(file);
});
