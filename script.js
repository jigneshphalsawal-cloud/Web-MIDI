class SoundSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.mainGain = this.ctx.createGain();
        this.fftNode = this.ctx.createAnalyser();
        this.fftNode.fftSize = 256;

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 20000;
        this.filterNode.Q.value = 1;

        this.delayUnit = this.ctx.createDelay(5);
        this.delayUnit.delayTime.value = 0;
        this.feedbackUnit = this.ctx.createGain();
        this.feedbackUnit.gain.value = 0;

        this.delayUnit.connect(this.feedbackUnit);
        this.feedbackUnit.connect(this.delayUnit);

        this.filterNode.connect(this.delayUnit);
        this.delayUnit.connect(this.mainGain);
        this.mainGain.connect(this.fftNode);
        this.fftNode.connect(this.ctx.destination);
        this.mainGain.gain.value = 0.7;

        this.soundBank = {
            'a': { freq: 150, type: 'sine' },
            's': { freq: 200, type: 'sine' },
            'd': { freq: 100, type: 'sine' },
            'f': { freq: 120, type: 'sine' },
            'j': { freq: 400, type: 'square' },
            'k': { freq: 600, type: 'square' },
            'l': { freq: 800, type: 'square' },
            'space': { freq: 60, type: 'sine' }
        };

        this.activeOscs = new Set();
        this.totalNotesPlayed = 0;

        this.soundModes = {
            chill: { filterFreq: 4000, delayTime: 0.35, delayFeedback: 0.25, masterGain: 0.6 },
            cyber: { filterFreq: 8000, delayTime: 0.2, delayFeedback: 0.4, masterGain: 0.7 },
            arcade: { filterFreq: 5000, delayTime: 0.15, delayFeedback: 0.3, masterGain: 0.65 }
        };

        this.recordedNotes = [];
        this.recordingFlag = false;
        this.loopingFlag = false;
        this.totalLoopLength = 0;
    }

    loadPreset(presetName) {
        const config = this.soundModes[presetName];
        if (!config) return;
        this.setFilterCutoff(config.filterFreq);
        this.setDelayTime(config.delayTime);
        this.setDelayFeedback(config.delayFeedback);
        this.setMasterGain(config.masterGain);
    }

    setFilterCutoff(frequencyVal) {
        this.filterNode.frequency.setTargetAtTime(frequencyVal, this.ctx.currentTime, 0.05);
    }

    setDelayTime(timeVal) {
        this.delayUnit.delayTime.setTargetAtTime(timeVal, this.ctx.currentTime, 0.05);
    }

    setDelayFeedback(amountVal) {
        this.feedbackUnit.gain.setTargetAtTime(amountVal, this.ctx.currentTime, 0.05);
    }

    setMasterGain(gainVal) {
        this.mainGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.05);
    }

    triggerDrum(inputKey) {
        const toneData = this.soundBank[inputKey];
        if (!toneData) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        const currentTime = this.ctx.currentTime;
        const oscNode = this.ctx.createOscillator();
        const gainEnv = this.ctx.createGain();

        oscNode.type = toneData.type;
        oscNode.frequency.value = toneData.freq;

        gainEnv.gain.setValueAtTime(0.8, currentTime);
        gainEnv.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);

        oscNode.connect(gainEnv);
        gainEnv.connect(this.filterNode);
        oscNode.start(currentTime);
        oscNode.stop(currentTime + 0.2);

        this.activeOscs.add(oscNode);
        oscNode.addEventListener('ended', () => this.activeOscs.delete(oscNode));
        this.totalNotesPlayed++;

        if (this.recordingFlag) {
            this.recordedNotes.push({ key: inputKey, time: currentTime - this.startTimeMarker });
        }
    }

    startRecording() {
        this.recordingFlag = true;
        this.recordedNotes = [];
        this.startTimeMarker = this.ctx.currentTime;
    }

    stopRecording() {
        if (!this.recordingFlag) return;
        this.recordingFlag = false;
        if (this.recordedNotes.length > 0) {
            const lastNoteTime = Math.max(...this.recordedNotes.map(item => item.time));
            this.totalLoopLength = lastNoteTime + 0.25;
        }
    }

    startLoopPlayback() {
        if (this.recordedNotes.length === 0) return;
        this.loopingFlag = true;

        const currentTime = this.ctx.currentTime;
        let nextLoopTime = currentTime + 0.05;

        const loopRunner = () => {
            if (!this.loopingFlag) return;
            const currentCtxTime = this.ctx.currentTime;
            while (nextLoopTime < currentCtxTime + 0.25) {
                for (const item of this.recordedNotes) {
                    this.triggerDrumAt(item.key, nextLoopTime + item.time);
                }
                nextLoopTime += this.totalLoopLength;
            }
            requestAnimationFrame(loopRunner);
        };

        requestAnimationFrame(loopRunner);
    }

    triggerDrumAt(inputKey, scheduledTime) {
        const toneData = this.soundBank[inputKey];
        if (!toneData) return;

        const oscNode = this.ctx.createOscillator();
        const gainEnv = this.ctx.createGain();

        oscNode.type = toneData.type;
        oscNode.frequency.value = toneData.freq;

        gainEnv.gain.setValueAtTime(0.8, scheduledTime);
        gainEnv.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.2);

        oscNode.connect(gainEnv);
        gainEnv.connect(this.filterNode);
        oscNode.start(scheduledTime);
        oscNode.stop(scheduledTime + 0.2);
    }

    stopLoopPlayback() {
        this.loopingFlag = false;
    }

    getFrequencyData() {
        const freqBuffer = new Uint8Array(this.fftNode.frequencyBinCount);
        this.fftNode.getByteFrequencyData(freqBuffer);
        return freqBuffer;
    }

    getWaveformData() {
        const waveBuffer = new Uint8Array(this.fftNode.fftSize);
        this.fftNode.getByteTimeDomainData(waveBuffer);
        return waveBuffer;
    }
}

class CanvasDrawer {
    constructor(elementId, audioSys) {
        this.canvasElement = document.getElementById(elementId);
        this.context2D = this.canvasElement.getContext('2d');
        this.audioSys = audioSys;
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        this.renderFrame();
    }

    handleResize() {
        const bounds = this.canvasElement.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        this.canvasElement.width = bounds.width * pixelRatio;
        this.canvasElement.height = bounds.height * pixelRatio;
        this.context2D.scale(pixelRatio, pixelRatio);
        this.canvasWidth = bounds.width;
        this.canvasHeight = bounds.height;
    }

    renderFrame() {
        requestAnimationFrame(() => this.renderFrame());

        const freqData = this.audioSys.getFrequencyData();
        this.context2D.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.context2D.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        const singleBarWidth = (this.canvasWidth / freqData.length) * 2.5;
        let xPos = 0;

        for (let idx = 0; idx < freqData.length; idx++) {
            const barHeight = (freqData[idx] / 255) * this.canvasHeight;
            const colorHue = (idx / freqData.length) * 180 + 180;
            this.context2D.fillStyle = `hsl(${colorHue}, 70%, ${40 + (freqData[idx] / 255) * 30}%)`;
            this.context2D.fillRect(xPos, this.canvasHeight - barHeight, singleBarWidth, barHeight);
            xPos += singleBarWidth + 1;
        }
    }
}

const mainAudio = new SoundSystem();
const mainVisuals = new CanvasDrawer('visualizer', mainAudio);

const presetButtons = document.querySelectorAll('.preset-btn');
presetButtons.forEach(btnElem => {
    btnElem.addEventListener('click', () => {
        presetButtons.forEach(el => el.classList.remove('active'));
        btnElem.classList.add('active');
        mainAudio.loadPreset(btnElem.dataset.preset);
    });
});

const drumPadElements = document.querySelectorAll('.drum-pad');
drumPadElements.forEach(padElem => {
    padElem.addEventListener('click', () => {
        mainAudio.triggerDrum(padElem.dataset.key);
        padElem.classList.add('active');
        setTimeout(() => padElem.classList.remove('active'), 150);
    });
});

const pressedKeys = new Set();
document.addEventListener('keydown', evt => {
    let keyVal = evt.key.toLowerCase();
    if (keyVal === ' ') keyVal = 'space';

    if (pressedKeys.has(keyVal)) return;
    pressedKeys.add(keyVal);

    const padElem = document.querySelector(`.drum-pad[data-key="${keyVal}"]`);
    if (padElem) {
        mainAudio.triggerDrum(keyVal);
        padElem.classList.add('active');
        setTimeout(() => padElem.classList.remove('active'), 150);
    }
});

document.addEventListener('keyup', evt => {
    let keyVal = evt.key.toLowerCase();
    if (keyVal === ' ') keyVal = 'space';
    pressedKeys.delete(keyVal);
});

document.getElementById('gainControl').addEventListener('input', evt => {
    mainAudio.setMasterGain(parseInt(evt.target.value) / 100);
    document.getElementById('gainValue').textContent = evt.target.value + '%';
});

document.getElementById('filterControl').addEventListener('input', evt => {
    const freqVal = 200 * Math.pow(100, parseInt(evt.target.value) / 100);
    mainAudio.setFilterCutoff(freqVal);
    document.getElementById('filterValue').textContent = freqVal >= 1000 ? (freqVal / 1000).toFixed(1) + 'kHz' : Math.round(freqVal) + 'Hz';
});

document.getElementById('delayControl').addEventListener('input', evt => {
    const timeVal = parseInt(evt.target.value) / 100;
    mainAudio.setDelayTime(timeVal);
    document.getElementById('delayValue').textContent = Math.round(timeVal * 1000) + 'ms';
});

document.getElementById('feedbackControl').addEventListener('input', evt => {
    mainAudio.setDelayFeedback(parseInt(evt.target.value) / 100);
    document.getElementById('feedbackValue').textContent = evt.target.value + '%';
});

const playButton = document.getElementById('playBtn');
const stopButton = document.getElementById('stopBtn');
const recordButton = document.getElementById('recordBtn');

playButton.addEventListener('click', () => {
    if (mainAudio.recordedNotes.length > 0) {
        mainAudio.startLoopPlayback();
        playButton.textContent = 'Playing Loop';
        playButton.classList.add('playing');
    } else {
        if (mainAudio.ctx.state === 'suspended') {
            mainAudio.ctx.resume();
        }
        playButton.textContent = 'Playing';
    }
    playButton.disabled = true;
    stopButton.disabled = false;
});

stopButton.addEventListener('click', () => {
    mainAudio.stopLoopPlayback();
    playButton.textContent = mainAudio.recordedNotes.length > 0 ? 'Play Loop' : 'Play';
    playButton.classList.remove('playing');
    playButton.disabled = false;
    stopButton.disabled = true;
});

recordButton.addEventListener('click', () => {
    if (recordButton.textContent === 'Record') {
        mainAudio.startRecording();
        recordButton.textContent = 'Stop Rec';
        recordButton.classList.add('recording');
        playButton.disabled = true;
    } else {
        mainAudio.stopRecording();
        recordButton.textContent = 'Record';
        recordButton.classList.remove('recording');
        playButton.disabled = false;
        if (mainAudio.totalLoopLength > 0) {
            triggerNotification(`Recorded ${mainAudio.recordedNotes.length} notes`);
        }
    }
});

setInterval(() => {
    document.getElementById('noteCount').textContent = mainAudio.totalNotesPlayed;
}, 100);

const processStartTime = Date.now();
setInterval(() => {
    const secondsPassed = Math.floor((Date.now() - processStartTime) / 1000);
    const mins = Math.floor(secondsPassed / 60);
    const secs = secondsPassed % 60;
    document.getElementById('timeDisplay').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}, 1000);

function triggerNotification(messageText) {
    const toastBox = document.getElementById('toast');
    toastBox.textContent = messageText;
    toastBox.classList.add('visible');
    setTimeout(() => toastBox.classList.remove('visible'), 2000);
}