
import { Component } from '@angular/core';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  transcripts: string[] = [];
  diarizationSegments: { speaker: string, text: string }[] = [];
  numberOfSpeakers: number = 0;
  isRecording = false;
diarizationContents: string = '';
speakerLines: string[] = [];

constructor(private router: Router) {}

speechRecognizer: SpeechSDK.SpeechRecognizer | null = null;

private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];

  startRecognition() {
    const key = 'Dnrhw3zPpaDffX1cKBSZiDJKvQom1dyPxag0bM3ghs5OYWVf9dFeJQQJ99BAACYeBjFXJ3w3AAAYACOG3ANV';
    const region = 'eastus';

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = 'en-US';

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    this.speechRecognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    this.speechRecognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        this.transcripts.push(e.result.text);
      }
    };

    this.speechRecognizer.startContinuousRecognitionAsync(() => {
      this.isRecording = true;
      this.transcripts = [];
      this.diarizationSegments = [];
      this.numberOfSpeakers = 0;
    });

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
      this.mediaRecorder.start();
    });
  }
  
stopRecognition() {
  if (!this.isRecording) return;
  this.isRecording = false;

  // 🛑 Stop Azure Speech Recognition
  if (this.speechRecognizer) {
    this.speechRecognizer.stopContinuousRecognitionAsync(
      () => console.log('Recognition stopped'),
      err => console.error('Error stopping recognition:', err)
    );
  }

  // 🛑 Handle MediaRecorder stop and upload
  if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
    const stream = this.mediaRecorder.stream;

    this.mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.uploadRawAudio(audioBlob);

        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        // Reset state
        this.audioChunks = [];
       this.speechRecognizer = null;
        this.mediaRecorder = null;
      } catch (error) {
        console.error('Error converting audio to WAV:', error);
      }
    };

    this.mediaRecorder.stop();
  }
}
uploadRawAudio(audioBlob: Blob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  fetch('https://localhost:44332/audio/upload', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    debugger;
    this.diarizationContents = data.diarizationContent || '';
    this.speakerLines = this.diarizationContents.split('\r\n').filter(line => line.trim().length > 0);

    // ✅ Custom call: log, notify, or trigger UI
    this.onDiarizationReceived(data);

    //  this.dataService.diarizationContent = data.diarizationContent;
    // this.dataService.finalTranscription = data.finalTranscription;

    // // ✅ Redirect to result page
    // this.router.navigate(['/result']);
  })
  .catch(err => console.error('Upload error:', err));
}
onDiarizationReceived(data: any) {
  console.log('🧠 Diarization received:', data);

  // Example: show toast, update dashboard, or trigger animation
  // this.toastService.show('Diarization complete!');
  // this.analyticsService.logEvent('diarization_complete', data);

  // You could also parse speaker segments here if needed
}
 
  getSpeakerColor(line: string): string {
    if (line.startsWith('Speaker 1')) return '#007bff'; // Blue
    if (line.startsWith('Speaker 2')) return '#28a745'; // Green
    return '#333'; // Default
  }
}
