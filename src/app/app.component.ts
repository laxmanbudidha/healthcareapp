import { Component, NgZone, OnInit } from '@angular/core';
import { SpeechService } from '../SpeechService';

interface AudioDevice {
  deviceId: string;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  transcripts: string[] = [];
  diarizationSegments: { speaker: string; text: string }[] = [];

  isRecording = false;
  isLoading = false;
  showDeviceChangeWarning = false;

  audioInputDevices: AudioDevice[] = [];
  selectedDeviceId: string | null = null;

  private audioChunks: Blob[] = [];      // ✅ All chunks from entire session
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(private speechService: SpeechService, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.autoSelectBestMic();

    navigator.mediaDevices.addEventListener('devicechange', async () => {
      const bestDevice = await this.autoSelectBestMic();
      if (this.isRecording) {
        this.showDeviceChangeWarning = true;
        if (!bestDevice) {
          // Wait until mic appears again
          const waitInt = setInterval(async () => {
            const found = await this.autoSelectBestMic();
            if (found) {
              clearInterval(waitInt);
              this.switchMic(found);
            }
          }, 1000);
        } else {
          this.switchMic(bestDevice);
        }
      }
    });
  }

  /** Detect mics and pick best */
  private async autoSelectBestMic(): Promise<string | null> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.audioInputDevices = devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Mic (${d.deviceId})`
      }));
    this.selectedDeviceId = this.getBestMic();
    return this.selectedDeviceId;
  }

  private getBestMic(): string | null {
    if (!this.audioInputDevices.length) return null;
    const headset = this.audioInputDevices.find(d =>
      /headset|usb|headphone/i.test(d.label.toLowerCase())
    );
    return headset ? headset.deviceId : this.audioInputDevices[0].deviceId;
  }

  /** Start full session */
  async startRecognition(): Promise<void> {
    if (this.isRecording || !this.selectedDeviceId) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: this.selectedDeviceId } }
    });
    this.startRecordingWithSpeech(stream);
    this.isRecording = true;
  }

  private startRecordingWithSpeech(stream: MediaStream) {
    this.mediaStream = stream;

    // Start Azure STT
    this.speechService.startRecognitionWithStream(stream, text => {
      if (text.trim()) this.transcripts.push(text);
    });

    // Start recording
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data); // ✅ Append new mic's audio
      }
    };
    this.mediaRecorder.start();
  }

  /** Stop full session */
  async stopRecognition(): Promise<void> {
    if (!this.isRecording) return;
    this.isLoading = true;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>(resolve => {
        this.mediaRecorder!.onstop = async () => {
          await this.uploadFullAudio();
          resolve();
        };
        this.mediaRecorder!.stop();
      });
    } else {
      await this.uploadFullAudio();
    }
  }

  /** Switch to new mic mid-session */
  private async switchMic(deviceId: string) {
    // Stop current recorder to flush current mic’s audio
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>(res => {
        this.mediaRecorder!.onstop = () => res();
        this.mediaRecorder!.stop();
      });
    }

    // Stop Azure and release old mic
    await this.speechService.stopRecognition();
    this.releaseCurrentStream();

    // Start new mic
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } }
    });
    this.startRecordingWithSpeech(newStream);
    this.selectedDeviceId = deviceId;
    this.showDeviceChangeWarning = false;
  }

  /** Merge & send final audio with all chunks */
  private async uploadFullAudio() {
    const blob = new Blob(this.audioChunks, { type: 'audio/wav' });

    // DEBUG — play full merged audio locally to verify
    // const url = URL.createObjectURL(blob);
    // window.open(url);

    try {
      await this.uploadToBackend(blob);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    await this.speechService.stopRecognition();
    this.cleanup();
  }

  /** Send to diarization endpoint */
  private async uploadToBackend(blob: Blob) {
    const formData = new FormData();
    formData.append('file', blob, 'recording.wav');

    const res = await fetch('https://localhost:44332/audio/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data?.diarizationContent) {
      this.ngZone.run(() => this.parseDiarization(data.diarizationContent));
    }
  }

  private parseDiarization(content: string) {
    const lines = content.split('\n').filter(l => l.trim());
    this.diarizationSegments = lines.map(line => {
      const [speaker, ...txt] = line.split(':');
      return {
        speaker: speaker.trim(),
        text: txt.join(':').trim()
      };
    });
  }

  private releaseCurrentStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
    }
    this.mediaStream = null;
    this.mediaRecorder = null;
  }

  private cleanup() {
    this.releaseCurrentStream();
    this.audioChunks = [];
    this.isRecording = false;
    this.isLoading = false;
    this.showDeviceChangeWarning = false;
  }
}
