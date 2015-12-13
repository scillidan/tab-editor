const getSpeedFromBpm = (bpm) => {
  return 60000 / bpm;
};

exports.getReplaySpeedForNote = (note, bpm) => {
  let noteLength = note.duration;

  let replaySpeed = getSpeedFromBpm(bpm);
  if(noteLength === 'h') {
    replaySpeed = replaySpeed * 2;
  } else if(noteLength === 'w') {
    replaySpeed = replaySpeed * 4;
  } else if(noteLength === 'e') {
    replaySpeed = replaySpeed / 2;
  } else if(noteLength === 's') {
    replaySpeed = replaySpeed / 4;
  }

  return replaySpeed;
};

const play = (audioContext, startTime, pitch, duration) => {
  let endTime = startTime + duration;

  let oscillator = audioContext.createOscillator();
  let gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if(pitch !== 'rest') {
    oscillator.type = 'square';
    oscillator.detune.value = (pitch - 29) * 100;

    gainNode.gain.value = 0.025;
  } else {
    gainNode.gain.value = 0;
  }

  oscillator.start(startTime);
  oscillator.stop(endTime);
};

const playNoteAtTime = (audioContext, currentNote, playTime, duration) => {
  if(currentNote === 'rest') {
    return play(audioContext, playTime, 'rest', duration / 1000);
  }

  for(let i = 0; i < currentNote.string.length; i++) {
    let pitch = currentNote.fret[i] + (5 * currentNote.string[i]);
    if(currentNote.string[i] >= 4) {
      pitch = pitch - 1;
    }

    play(audioContext, playTime, pitch, duration / 1000);
  }
};

exports.playCurrentNote = (audioContext, song, bpm, playingIndex) => {
  let measure = song[playingIndex.measure];
  let noteToPlay;
  if(measure.notes.length > 0) {
    noteToPlay = measure.notes[playingIndex.noteIndex];
  } else {
    noteToPlay = { duration: 'w', fret: ['rest'] };
  }

  let replaySpeed = exports.getReplaySpeedForNote(noteToPlay, bpm);

  if(noteToPlay.fret[0] === 'rest') {
    playNoteAtTime(audioContext, 'rest', audioContext.currentTime, replaySpeed);
  } else {
    playNoteAtTime(audioContext, noteToPlay, audioContext.currentTime, replaySpeed);
  }
};
