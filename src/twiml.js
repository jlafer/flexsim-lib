
export function addSpeechToTwiml(twiml, params) {
  const { speech, intent, mode, isCenter, pauseBetween } = params;
  let elapsedOtherSpeech = 0;
  let elapsedPaused = 0;
  let elapsedAll = 0;
  let idx = 0;
  const convo = intent || 'default';
  const convoSpeech = speech[convo] || speech.default;
  const voice = (isCenter)
    ? centerVoiceForMode(speech, mode)
    : speech.voices.customer;

  convoSpeech[mode].forEach(line => {
    const sepIdx = line.indexOf('-');
    const speechDur = parseInt(line.slice(0, sepIdx));
    const text = line.slice(sepIdx + 1);

    elapsedAll += speechDur;

    if (thisPartySpeaks(idx, isCenter)) {
      twiml.say({ voice }, text);
    }
    else {
      elapsedOtherSpeech += speechDur;
      const pauseDelta = elapsedOtherSpeech - elapsedPaused;
      const durationSecs = Math.round(pauseDelta / 1000);
      const pauseActual = durationSecs * 1000;
      elapsedAll += (pauseBetween * 1000);
      twiml.pause({ length: durationSecs + pauseBetween });
      elapsedPaused += pauseActual;
    }
    idx += 1;
  });
  return Math.round(elapsedAll / 1000);
}

function thisPartySpeaks(idx, isCenter) {
  return (idx % 2 === 0) === isCenter
}

function centerVoiceForMode(speech, mode) {
  const persona = (mode === 'selfService') ? 'ivr' : 'agent';
  return speech.voices[persona];
}