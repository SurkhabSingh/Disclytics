function createVoiceStateUpdateHandler(voiceTrackingService) {
  return async function handleVoiceStateUpdate(oldState, newState) {
    await voiceTrackingService.handleVoiceStateUpdate(oldState, newState);
  };
}

module.exports = { createVoiceStateUpdateHandler };
