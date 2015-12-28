import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import * as TrackActions from '../actions/track';
import * as MeasureActions from '../actions/measure';
import { playCurrentNote, getReplaySpeedForNote } from '../util/audio';

import Soundfont from 'soundfont-player';

import TabRows from '../components/TabRows';
import EditorArea from '../components/editor/EditorArea';
import TimeSignatureModal from '../components/editor/TimeSignatureModal';
import TuningModal from '../components/editor/TuningModal';
import BpmModal from '../components/editor/BpmModal';

const Actions = _.merge(TrackActions, MeasureActions);

class App extends Component {
  constructor(props) {
    super(props);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyPress);
      window.addEventListener('resize', this.handleResize);
    }

    let audioContext;
    try {
      audioContext = new AudioContext();
    } catch(e) {
      audioContext = new webkitAudioContext();
    }

    this.state = {
      currentPlayingNote: {
        measure: 0,
        noteIndex: 0
      },
      currentEditingIndex: {
        measureIndex: 0,
        noteIndex: 0,
        stringIndex: 0
      },
      audioContext,
      isPlaying: false,
      layout: 'page'
    };
  }

  componentWillMount = () => {
    const ctx = this.state.audioContext;

    Soundfont.loadBuffers(ctx, 'acoustic_guitar_steel').then((buffers) => {
      this.setState({ buffers });
    });
  }

  handleResize = () => {
    this.forceUpdate();
  }

  getXOfCurrentNote = () => {
    const { measure, noteIndex } = this.state.currentPlayingNote;
    const xOfMeasures = this.props.track.measures.reduce((acc, curr, i) => {
      if(i >= measure) {
        return acc;
      }
      return acc + curr.width;
    }, 0);

    return xOfMeasures + 55 * noteIndex;
  }

  updateScrollPosition = () => {
    const x = this.getXOfCurrentNote();
    const scrollX = window.scrollX;

    if(x > window.innerWidth + scrollX - 200 && this.state.layout === 'linear') {
      window.scroll(x - 200, 0);
    }
  }

  startPlayback = () => {
    let startTimestamp = Date.now();
    this.updateScrollPosition();
    playCurrentNote(this.state.audioContext, this.props.track, this.state.currentPlayingNote, this.state.buffers);

    this.setState({
      timer: requestAnimationFrame(() => {
        this.loopThroughSong(startTimestamp);
      })
    });
  }

  loopThroughSong = (startTimestamp) => {
    let { currentPlayingNote, audioContext } = this.state;
    let { measure, noteIndex } = currentPlayingNote;
    let { measures } = this.props.track;

    let currentTimestamp = Date.now();
    let replayDiff = currentTimestamp - startTimestamp;

    const measureToPlay = measures[currentPlayingNote.measure];
    const bpm = measureToPlay.bpm;

    let replaySpeed;
    if(measureToPlay.notes.length > 0) {
      replaySpeed = getReplaySpeedForNote(measureToPlay.notes[noteIndex], bpm);
    } else {
      replaySpeed = bpm * 4;
    }

    if(replayDiff >= replaySpeed) {
      if(measure === measures.length - 1 && noteIndex >= measures[measure].notes.length - 1) {
        this.handleStop();
      } else if(measure !== measures.length - 1 && noteIndex >= measures[measure].notes.length - 1) {
        this.setState({
          currentPlayingNote: {
            measure: measure + 1,
            noteIndex: 0
          },
          currentEditingIndex: {
            stringIndex: this.state.currentEditingIndex.stringIndex,
            measureIndex: measure + 1,
            noteIndex: 0
          },
          timer: requestAnimationFrame(() => {
            this.loopThroughSong(currentTimestamp);
          })
        }, () => {
          this.updateScrollPosition();
          playCurrentNote(audioContext, this.props.track, this.state.currentPlayingNote, this.state.buffers);
        });
      } else {
        this.setState({
          currentPlayingNote: {
            measure: measure,
            noteIndex: noteIndex + 1
          },
          currentEditingIndex: {
            stringIndex: this.state.currentEditingIndex.stringIndex,
            measureIndex: measure,
            noteIndex: noteIndex + 1
          },
          timer: requestAnimationFrame(() => {
            this.loopThroughSong(currentTimestamp);
          })
        }, () => {
          this.updateScrollPosition();
          playCurrentNote(audioContext, this.props.track, this.state.currentPlayingNote, this.state.buffers);
        });
      }
    } else {
      this.setState({
        timer: requestAnimationFrame(() => {
          this.loopThroughSong(startTimestamp);
        })
      });
    }
  }

  handleStop = () => {
    cancelAnimationFrame(this.state.timer);

    this.setState({
      isPlaying: false
    });
  }

  handlePlay = () => {
    if(this.state.isPlaying || !this.state.buffers) {
      return;
    }

    this.setState({
      isPlaying: true,
    }, () => {
      this.startPlayback();
    });
  }

  onNoteClick = (index) => {
    this.setState({
      currentEditingIndex: index,
      currentPlayingNote: {
        measure: index.measureIndex,
        noteIndex: index.noteIndex
      }
    });
  }

  getCurrentNote = () => {
    const { measures } = this.props.track;
    const { measureIndex, noteIndex } = this.state.currentEditingIndex;

    return measures[measureIndex].notes[noteIndex];
  }

  getNextNote = (measureIndex, noteIndex) => {
    const { measures } = this.props.track;

    if(measureIndex === measures.length - 1 && noteIndex >= measures[measureIndex].notes.length - 1) {
      return 'NEW';
    } else if(noteIndex >= measures[measureIndex].notes.length - 1) {
      return {
        measureIndex: measureIndex + 1,
        noteIndex: 0
      };
    } else {
      return {
        measureIndex,
        noteIndex: noteIndex + 1
      };
    }
  }

  getPrevNote = (measureIndex, noteIndex) => {
    const { measures } = this.props.track;

    if(measureIndex === 0 && noteIndex === 0) {
      return { measureIndex, noteIndex };
    } else if(noteIndex === 0) {
      let prevMeasure = measures[measureIndex - 1];
      if(prevMeasure.notes.length > 0) {
        return {
          measureIndex: measureIndex - 1,
          noteIndex: measures[measureIndex - 1].notes.length - 1
        };
      } else {
        return {
          measureIndex: measureIndex - 1,
          noteIndex: 0
        };
      }
    } else {
      return {
        measureIndex,
        noteIndex: noteIndex - 1
      };
    }
  }

  getUpperString = (stringIndex) => {
    return stringIndex === 5 ? 0 : stringIndex + 1;
  }

  getLowerString = (stringIndex) => {
    return stringIndex === 0 ? 5 : stringIndex - 1;
  }

  navigateCursor = (event) => {
    let { measureIndex, noteIndex, stringIndex } = this.state.currentEditingIndex;

    if(event.keyCode === 39) { // right arrow
      let newEditingIndex = this.getNextNote(measureIndex, noteIndex);
      if(newEditingIndex === 'NEW') {
        this.props.actions.insertMeasure(0);
        newEditingIndex = {
          stringIndex,
          measureIndex: measureIndex + 1,
          noteIndex: 0
        };
        this.setState({
          currentEditingIndex: newEditingIndex,
          currentPlayingNote: {
            measure: newEditingIndex.measureIndex,
            noteIndex: newEditingIndex.noteIndex
          }
        });
      } else {
        newEditingIndex.stringIndex = stringIndex;
        this.setState({
          currentEditingIndex: newEditingIndex,
          currentPlayingNote: {
            measure: newEditingIndex.measureIndex,
            noteIndex: newEditingIndex.noteIndex
          }
        });
      }
    } else if(event.keyCode === 37) { // left arrow
      let newEditingIndex = this.getPrevNote(measureIndex, noteIndex);
      newEditingIndex.stringIndex = stringIndex;
      this.setState({
        currentEditingIndex: newEditingIndex,
        currentPlayingNote: {
          measure: newEditingIndex.measureIndex,
          noteIndex: newEditingIndex.noteIndex
        }
      });
    } else if(event.keyCode === 38) { // up arrow
      event.preventDefault();
      let newEditingIndex = {
        stringIndex: this.getUpperString(stringIndex),
        noteIndex,
        measureIndex
      };
      this.setState({
        currentEditingIndex: newEditingIndex
      });
    } else if(event.keyCode === 40) { // down arrow
      event.preventDefault();
      let newEditingIndex = {
        stringIndex: this.getLowerString(stringIndex),
        noteIndex,
        measureIndex
      };
      this.setState({
        currentEditingIndex: newEditingIndex
      });
    }
  }

  editNote = (fret) => {
    this.props.actions.changeNote(this.state.currentEditingIndex, fret);
  }

  changeNoteLength = (duration) => {
    this.props.actions.changeNoteLength(this.state.currentEditingIndex, duration);
  }

  deleteNote = () => {
    const { noteIndex, measureIndex, stringIndex } = this.state.currentEditingIndex;
    let notes = this.props.track.measures[measureIndex].notes;

    if(notes.length > 1 && noteIndex === notes.length - 1 && notes[notes.length - 1].fret[0] === 'rest') {
      this.setState({
        currentEditingIndex: {
          stringIndex,
          measureIndex,
          noteIndex: noteIndex - 1
        }
      }, () => {
        this.props.actions.deleteNote({ stringIndex, measureIndex, noteIndex });
      });
    } else if(notes.length === 0) {
      this.props.actions.deleteMeasure(measureIndex);

      if(measureIndex === this.props.track.measures.length) {
        this.setState({
          currentEditingIndex: {
            stringIndex,
            measureIndex: measureIndex - 1,
            noteIndex: 0
          }
        });
      }
    } else {
      this.props.actions.deleteNote(this.state.currentEditingIndex);
    }
  }

  insertNote = () => {
    const { noteIndex, measureIndex, stringIndex } = this.state.currentEditingIndex;
    this.props.actions.insertNote(this.state.currentEditingIndex);

    if(this.props.track.measures[measureIndex].notes.length !== 1) {
      this.setState({
        currentEditingIndex: {
          measureIndex,
          stringIndex,
          noteIndex: noteIndex + 1
        }
      });
    }
  }

  pasteNote = () => {
    const { measureIndex, noteIndex, stringIndex } = this.state.currentEditingIndex;

    this.props.actions.pasteNote(this.state.currentEditingIndex, this.props.clipboard);
    this.setState({
      currentEditingIndex: {
        measureIndex,
        noteIndex: this.props.track.measures[measureIndex].notes.length === 1 && noteIndex === 0 ? 0 : noteIndex + 1,
        stringIndex
      }
    });
  }

  handleKeyPress = (event) => {
    if(this.state.timeSignatureModal || this.state.tuningModal || this.state.bpmModal) {
      return;
    }

    if((event.metaKey || event.ctrlKey) && event.keyCode === 67) { // cmd/ctrl+c
      event.preventDefault();
      return this.props.actions.copyNote(this.getCurrentNote());
    }
    if((event.metaKey || event.ctrlKey) && event.keyCode === 86) { // cmd/ctrl+v
      event.preventDefault();
      return this.pasteNote();
    }
    if((event.metaKey || event.ctrlKey) && event.keyCode === 88) { // cmd/ctrl+c
      event.preventDefault();
      const { noteIndex, measureIndex, stringIndex } = this.state.currentEditingIndex;
      let notes = this.props.track.measures[measureIndex].notes;
      if(notes.length > 1 && noteIndex === notes.length - 1) {
        const currentNote = this.getCurrentNote();

        this.setState({
          currentEditingIndex: {
            stringIndex,
            measureIndex,
            noteIndex: noteIndex - 1
          }
        }, () => {
          this.props.actions.cutNote({ noteIndex: noteIndex, measureIndex, stringIndex }, currentNote);
        });
      } else {
        return this.props.actions.cutNote({ noteIndex, measureIndex, stringIndex }, this.getCurrentNote());
      }
    }

    if(event.metaKey) {
      return;
    } else if(this.state.isPlaying && event.keyCode !== 32) {
      return;
    } else if(this.state.tuningModal || this.state.timeSignatureModal) {
      return;
    }

    if(event.keyCode <= 57 && event.keyCode >= 48) {
      return this.editNote(event.keyCode - 48);
    } else if(event.keyCode === 82 && !event.metaKey && !event.ctrlKey) {
      this.props.actions.changeNote(this.state.currentEditingIndex, 'rest');
    } else if(event.keyCode === 8) { // delete
      event.preventDefault();
      this.deleteNote();
    } else if(event.keyCode === 69) { // e
      return this.changeNoteLength('e');
    } else if(event.keyCode === 83) { // s
      return this.changeNoteLength('s');
    } else if(event.keyCode === 81) { // q
      return this.changeNoteLength('q');
    } else if(event.keyCode === 87) { // w
      return this.changeNoteLength('w');
    } else if(event.keyCode === 72 && !event.ctrlKey) { // h
      return this.changeNoteLength('h');
    } else if(event.keyCode === 73) { // i
      return this.insertNote();
    } else if(event.keyCode === 32) { // spacebar
      event.preventDefault();
      return this.state.isPlaying ? this.handleStop() : this.handlePlay();
    } else if(event.keyCode === 190) { // period
      this.props.actions.toggleNoteDotted(this.state.currentEditingIndex);
    } else {
      return this.navigateCursor(event);
    }
  }

  openTimeSignatureModal = () => {
    this.setState({
      timeSignatureModal: true
    });
  }

  openBpmModal = () => {
    this.setState({
      bpmModal: true
    });
  }

  closeModal = () => {
    this.setState({
      timeSignatureModal: false,
      tuningModal: false,
      bpmModal: false
    });
  }

  toggleLayout = () => {
    let layout = this.state.layout === 'page' ? 'linear' : 'page';
    this.setState({ layout });
  }

  openTuningModal = () => {
    this.setState({
      tuningModal: true
    });
  }

  render() {
    const { measures } = this.props.track;
    const { measureIndex } = this.state.currentEditingIndex;
    const timeSignature = measures[measureIndex] ? measures[measureIndex].timeSignature : '4/4';

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <EditorArea handlePlay={this.handlePlay}
          handleStop={this.handleStop}
          openModal={this.openTimeSignatureModal}
          openTuning={this.openTuningModal}
          openBpm={this.openBpmModal}
          toggleLayout={this.toggleLayout}
          timeSignature={timeSignature}
          layout={this.state.layout}
        />
        <TabRows track={measures} layout={this.state.layout}
          currentEditingIndex={this.state.currentEditingIndex}
          currentPlayingNote={this.state.currentPlayingNote}
          isPlaying={this.state.isPlaying}
          onClick={this.onNoteClick}
        />
        <TimeSignatureModal isOpen={this.state.timeSignatureModal} closeModal={this.closeModal}
          measureIndex={measureIndex} timeSignature={timeSignature}
        />
        <TuningModal isOpen={this.state.tuningModal} closeModal={this.closeModal} />
        <BpmModal isOpen={this.state.bpmModal} closeModal={this.closeModal} index={this.state.currentEditingIndex} />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    track: state.tracks[state.currentTrackIndex],
    clipboard: state.clipboard
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch)
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
