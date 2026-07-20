import { useState, useRef, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useAdminSpy(appId, db, settings, showNotify) {
    const [isSpyVisible, setIsSpyVisible] = useState(false); // 🔥 State bash nkhbiw bouton l'écoute
    


    return {
        isSpyVisible, setIsSpyVisible,
        showSpyModal, setShowSpyModal,
        spyTargetType, setSpyTargetType,
        spyBranchId, setSpyBranchId,
        spyStatus, setSpyStatus,
        spyStream, setSpyStream,
        isRecording, setIsRecording,
        isRollingRecordEnabled, setIsRollingRecordEnabled,
        startSpy, stopSpy, handleDownloadRecording, audioRef, startRecording, stopRecording, downloadLastHour
    };
}
