import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAudio } from '../../context/AudioContext';
import { formatCountdown } from '../../utils/format';

const OPTIONS = [5, 15, 30, 45, 60];

export default function SleepTimerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { sleepTimerTimeLeft, sleepAtEndOfTrack, setSleepTimer, setSleepTimerEndOfTrack } = useAudio();
  const active = sleepTimerTimeLeft !== null || sleepAtEndOfTrack;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Sleep timer</Text>
          {sleepTimerTimeLeft !== null && (
            <Text style={styles.status}>Music stops in {formatCountdown(sleepTimerTimeLeft)}</Text>
          )}
          {sleepAtEndOfTrack && <Text style={styles.status}>Music stops after this song</Text>}

          {OPTIONS.map((m) => (
            <TouchableOpacity
              key={m}
              style={styles.option}
              onPress={() => {
                setSleepTimer(m);
                onClose();
              }}
            >
              <Text style={styles.optionText}>{m} minutes</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.option}
            onPress={() => {
              setSleepTimerEndOfTrack();
              onClose();
            }}
          >
            <Text style={styles.optionText}>End of track</Text>
          </TouchableOpacity>
          {active && (
            <TouchableOpacity
              style={[styles.option, styles.divider]}
              onPress={() => {
                setSleepTimer(null);
                onClose();
              }}
            >
              <Text style={[styles.optionText, { color: '#FF5252' }]}>Turn off timer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.option, styles.divider]} onPress={onClose}>
            <Text style={[styles.optionText, { color: '#B3B3B3', fontWeight: 'bold' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#282828', borderRadius: 14, width: '100%', maxWidth: 320, padding: 16 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  status: { color: '#1DB954', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  option: { paddingVertical: 14, alignItems: 'center' },
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
});
