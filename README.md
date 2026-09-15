# Web-MIDI

An interactive browser synthesizer with real-time audio visualizer.Interfaces directly with keyboard to render real-time sound synthesis.

---

### what it actually does

* **plugs into real hardware:** uses native web midi to talk to external keyboards
* **canvas oscilloscope:** reads time-domain audio data straight from an analyser node to draw live, low-latency waveforms.
* **patch storage:** delay and filter knobs, then save your setups locally or dump them into a json file to share.
* **qwerty fallback:** if you don't have a physical midi keyboard plugged in right now, you can play notes with your computer keyboard or click the UI keys.

---



 
### tech under the hood

* **vanilla javascript (es6+)** 
* **web midi api** 
* **html5 canvas** 

---

### running it locally

you don't need `npm install` or node to run this.

1. clone the repo:
   ```bash
   git clone [https://github.com/your-username/web-midi-synth.git](https://github.com/your-username/web-midi-synth.git)
   cd web-midi-synth


### Note:- I have used AI to debug and organise my code only