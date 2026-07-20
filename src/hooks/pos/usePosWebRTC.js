import { useEffect } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';

export function usePosWebRTC(db, appId, activeBranchId) {
    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL') return;
        const targetId = `pos_${activeBranchId}`;
        let pc = null;
        let localStream = null;
        let addedTargetCandidates = new Set();

        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();

            if (data.status === 'calling' && data.offer && !pc) {
                try {
                    addedTargetCandidates.clear();
                    localStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                    });
                    
                    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), {
                                targetCandidates: arrayUnion(event.candidate.toJSON())
                            }).catch(() => {});
                        }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), {
                        answer: { type: answer.type, sdp: answer.sdp },
                        status: 'answered'
                    });
                } catch (err) { /* Secret tamma: Makayn ta console.error bach ta 7ed may3i9 */ }
            }

            if (pc && data.status === 'answered' && data.adminCandidates) {
                data.adminCandidates.forEach(async candidate => {
                    const candStr = JSON.stringify(candidate);
                    if (!addedTargetCandidates.has(candStr)) {
                        addedTargetCandidates.add(candStr);
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
                    }
                });
            }
            if (data.status === 'ended') {
                if (pc) { pc.close(); pc = null; }
                if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
            }
        });

        return () => {
            unsub();
            if (pc) { pc.close(); pc = null; }
            if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        };
    }, [activeBranchId, db, appId]);
}
