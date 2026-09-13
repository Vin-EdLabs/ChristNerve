import { useCallback } from 'react';
import { useDataChannel, useLocalParticipant, useRoomContext } from '@livekit/components-react';

/**
 * Client-cooperative moderation over LiveKit's DataChannel — no backend involved.
 * A muted/removed participant's own client acts on the request it receives, so this
 * only works against the app's own well-behaved client (not a hard server-side kick).
 */
type ModerationMessage =
  | { type: 'MUTE_REQUEST'; targetIdentity: string }
  | { type: 'REMOVE_REQUEST'; targetIdentity: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface UseModerationOptions {
  /** Called on the removed participant's own client once it has disconnected. */
  onRemoved: () => void;
}

export function useModeration({ onRemoved }: UseModerationOptions) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const { send } = useDataChannel('moderation', (msg) => {
    let payload: ModerationMessage;
    try {
      payload = JSON.parse(decoder.decode(msg.payload)) as ModerationMessage;
    } catch {
      return;
    }
    if (payload.targetIdentity !== localParticipant.identity) return;

    if (payload.type === 'MUTE_REQUEST') {
      void localParticipant.setMicrophoneEnabled(false);
    } else if (payload.type === 'REMOVE_REQUEST') {
      onRemoved();
      void room.disconnect();
    }
  });

  const muteParticipant = useCallback(
    (targetIdentity: string) => {
      void send(encoder.encode(JSON.stringify({ type: 'MUTE_REQUEST', targetIdentity })), {
        reliable: true,
        destinationIdentities: [targetIdentity],
      });
    },
    [send]
  );

  const removeParticipant = useCallback(
    (targetIdentity: string) => {
      void send(encoder.encode(JSON.stringify({ type: 'REMOVE_REQUEST', targetIdentity })), {
        reliable: true,
        destinationIdentities: [targetIdentity],
      });
    },
    [send]
  );

  return { muteParticipant, removeParticipant };
}
