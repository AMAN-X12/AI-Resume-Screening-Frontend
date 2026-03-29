document.addEventListener('DOMContentLoaded', () => {

    const uploadForm = document.getElementById('uploadForm');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileListContainer = document.getElementById('fileListContainer');
    const jobSkillsInput = document.getElementById('jobSkills');
    const reqExperienceInput = document.getElementById('reqExperience');
    const runBtn = document.getElementById('runBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultCount = document.getElementById('resultCount');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');

    const API_BASE_URL = "https://aman-x12-ai-resume-screener.hf.space";

    let selectedFiles = [];
    let currentSessionId = null;


    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--primary)";
        dropzone.style.backgroundColor = "#F3F4F6";
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = "var(--border)";
        dropzone.style.backgroundColor = "#F9FAFB";
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--border)";
        dropzone.style.backgroundColor = "#F9FAFB";
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.pdf'));

        newFiles.forEach(newFile => {
            const isDuplicate = selectedFiles.some(existingFile => existingFile.name === newFile.name);
            if (!isDuplicate && selectedFiles.length < 30) {
                selectedFiles.push(newFile);
            }
        });

        if (selectedFiles.length === 30 && newFiles.length > 0) {
            console.log("Maximum of 30 resumes reached.");
        }

        updateFileUI();
        fileInput.value = "";
    }

    function updateFileUI() {
        const textElement = dropzone.querySelector('p');
        fileListContainer.innerHTML = "";

        if (selectedFiles.length > 0) {
            textElement.innerHTML = `<strong>Add more files</strong><br>(${selectedFiles.length}/30 uploaded)`;
            dropzone.style.borderColor = "var(--primary)";

            selectedFiles.forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-item';
                fileDiv.innerHTML = `
                    <span class="file-item-name" title="${file.name}">📄 ${file.name}</span>
                    <button type="button" class="remove-file-btn" data-index="${index}" title="Remove file">✕</button>
                `;
                fileListContainer.appendChild(fileDiv);
            });

            const removeBtns = fileListContainer.querySelectorAll('.remove-file-btn');
            removeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    removeFile(idx);
                });
            });
        } else {
            textElement.innerHTML = `<strong>Click to upload</strong> or drag and drop<br>up to 30 PDF resumes.`;
            dropzone.style.borderColor = "var(--border)";
        }
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileUI();
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedFiles.length === 0) {
            alert("⚠️ Please upload at least one PDF resume.");
            return;
        }
        if (!jobSkillsInput.value.trim()) {
            alert("⚠️ Please fill in the Required Job Skills.");
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => formData.append("resumes", file));
        formData.append("job_skills", jobSkillsInput.value);

        const expValue = reqExperienceInput.value ? reqExperienceInput.value : "";
        formData.append("required_experience", expValue);

        runBtn.disabled = true;
        runBtn.textContent = "Processing...";"Waking up AI & Analyzing (May take 1-2 mins)...";
        loadingOverlay.classList.remove('hidden');
        resultsTableBody.innerHTML = "";

        try {
            const response = await fetch(`${API_BASE_URL}/filter`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = "Something went wrong on the server.";
                try {
                    const errorData = await response.json();
                    errorMessage = typeof errorData.detail === 'string'
                        ? errorData.detail
                        : JSON.stringify(errorData.detail);
                } catch (parseError) {
                    errorMessage = `Server Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            currentSessionId = data.session_id;
            renderTable(data.results);

        } catch (error) {
            console.error("API Error:", error);
            if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
                alert("Analysis Failed: The AI server is still booting up! Please wait 60 seconds and click Run Analysis again.");
            } else {
                alert(`Analysis Failed:\n\n${error.message}`);
            }
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = "Run Analysis";
            loadingOverlay.classList.add('hidden');
        }
    });

    function renderTable(candidatesArray) {
        resultCount.textContent = `(${candidatesArray.length} Candidates)`;
        resultsTableBody.innerHTML = "";

        if (candidatesArray.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="5" class="blank-state-cell">No candidates processed yet.</td></tr>`;
            return;
        }

        candidatesArray.forEach((candidate, index) => {
            const skillPct = (candidate.skill_score * 100).toFixed(0) + "%";
            const expPct = (candidate.experience_score * 100).toFixed(0) + "%";
            const finalPct = (candidate.weighted_score * 100).toFixed(0) + "%";


            const rowHTML = `
                <tr>
                    <td><strong>${index + 1}</strong></td>
                    <td>
                        <div>${candidate.name}</div>
                        <div class="candidate-email">${candidate.email}</div>
                    </td>
                    <td>${skillPct}</td>
                    <td>${expPct}</td>
                    <td><strong>${finalPct}</strong></td>
                </tr>
            `;

            resultsTableBody.innerHTML += rowHTML;
        });
    }
exportBtn.addEventListener('click', async () => {
        try {
            if (!currentSessionId) {
    alert("Please run an analysis first!");
    return;
}
            const response = await fetch(`${API_BASE_URL}/export/${currentSessionId}`);

            if (!response.ok) {
                const errorData = await response.json();
                alert(`⚠️ Export Failed: ${errorData.detail}`);
                return;
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = "Screening_Results.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            console.error("Export Error:", error);
            alert("Export failed due to a network error.");
        }
    });

    clearBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE_URL}/results/${currentSessionId}`, { method: 'DELETE' });
            currentSessionId = null;
            resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="blank-state-cell">
                        <svg class="blank-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <p>No candidates processed yet.</p>
                        <p class="blank-state-subtext">Upload resumes and click Run Analysis to see results.</p>
                    </td>
                </tr>
            `;
            resultCount.textContent = `(0 Candidates)`;
            selectedFiles = [];
            updateFileUI();
            uploadForm.reset();

        } catch (error) {
            console.error("Error clearing results:", error);
        }
    });

});
