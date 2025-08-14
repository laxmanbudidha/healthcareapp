// import { Injectable } from '@angular/core';
// import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

// @Injectable({
//   providedIn: 'root'
// })
// export class SpeechService {
//   private speechConfig: SpeechSDK.SpeechConfig;
//   private recognizer: SpeechSDK.SpeechRecognizer | null = null;

//   constructor() {
//     // ⚠️ Replace with your environment variables or secure fetch from backend
//     this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
//       'Dnrhw3zPpaDffX1cKBSZiDJKvQom1dyPxag0bM3ghs5OYWVf9dFeJQQJ99BAACYeBjFXJ3w3AAAYACOG3ANV',
//       'eastus'
//     );
//     this.speechConfig.speechRecognitionLanguage = 'en-US';
//   }

//   startRecognition(onRecognized: (text: string) => void) {
//     const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
//     this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

//     this.recognizer.recognized = (s, e) => {
//       if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
//         onRecognized(e.result.text);
//       }
//     };

//     this.recognizer.startContinuousRecognitionAsync();
//   }

//   stopRecognition(): Promise<void> {
//     return new Promise((resolve) => {
//       if (this.recognizer) {
//         this.recognizer.stopContinuousRecognitionAsync(() => {
//           this.recognizer?.close();
//           this.recognizer = null;
//           resolve();
//         });
//       } else {
//         resolve();
//       }
//     });
//   }
// }
import { Injectable } from '@angular/core';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private speechConfig: SpeechSDK.SpeechConfig;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;

  constructor() {
    // ⚠ Replace with your real key & region
  this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      '',
      'eastus'
    );
    this.speechConfig.speechRecognitionLanguage = 'en-US';
  }

  startRecognitionWithStream(stream: MediaStream, onRecognized: (text: string) => void) {
    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(() => {
        this.recognizer?.close();
        this.recognizer = null;
      });
    }

    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream as any);
    this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

    this.recognizer.recognized = (_, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        onRecognized(e.result.text);
      }
    };

    this.recognizer.startContinuousRecognitionAsync();
  }

  stopRecognition(): Promise<void> {
    return new Promise((resolve) => {
      if (this.recognizer) {
        this.recognizer.stopContinuousRecognitionAsync(() => {
          this.recognizer?.close();
          this.recognizer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
