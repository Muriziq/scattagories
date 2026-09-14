"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FaTimes, FaLock, FaExclamationTriangle, FaUsers, FaGamepad } from "react-icons/fa";
import authStyles from "../authmodel.module.css";
import AuthModel from "../authModels";

export interface ErrorModalsProps {
    roomId: string;
    showAuthModal: boolean;
    enterAsGuest?: () => void;
    onCloseAuthModal?: () => void;

    showPasswordModal?: boolean;
    inputPassword?: string;
    setInputPassword?: (val: string) => void;
    handlePasswordSubmit?: (e: React.FormEvent) => void;
    onClosePasswordModal?: () => void;

    showRoomModal?: boolean;
    roomErrorMsg?: string | null;
    onCloseRoomModal?: () => void;

    showNotStartedModal?: boolean;
    notStartedMsg?: string | null;
    onCloseNotStartedModal?: () => void;

    showChangeRoomModal?: boolean;
    previousRoomId?: string;
    handleLeavePrevAndJoinNew?: () => void;
    handleGoToPrevRoom?: () => void;
    onCloseChangeRoomModal?: () => void;
}

export default function ErrorModals({
    roomId,
    showAuthModal,
    enterAsGuest,
    onCloseAuthModal,

    showPasswordModal,
    inputPassword = "",
    setInputPassword,
    handlePasswordSubmit,
    onClosePasswordModal,

    showRoomModal,
    roomErrorMsg,
    onCloseRoomModal,

    showNotStartedModal,
    notStartedMsg,
    onCloseNotStartedModal,

    showChangeRoomModal,
    previousRoomId = "",
    handleLeavePrevAndJoinNew,
    handleGoToPrevRoom,
    onCloseChangeRoomModal,
}: ErrorModalsProps) {
    const router = useRouter();

    return (
        <>
            {/* AUTH REQUIRED MODAL */}
            {showAuthModal && (
                <AuthModel
                    modelFunction={enterAsGuest}
                    cancelModal={onCloseAuthModal || (() => router.push("/"))}
                />
            )}

            {/* PASSWORD REQUIRED MODAL */}
            {showPasswordModal && (
                <div className={authStyles.modalOverlay}>
                    <div className={authStyles.modalCard}>
                        <button
                            type="button"
                            className={authStyles.closeModalBtn}
                            onClick={onClosePasswordModal || (() => router.push("/games/rooms"))}
                            aria-label="Close modal"
                        >
                            <FaTimes />
                        </button>
                        <FaLock size={56} className={authStyles.modalIcon} />
                        <h3 className={authStyles.modalTitle}>Password Required</h3>
                        <p className={authStyles.modalDescription}>
                            This room is password protected. Please enter the correct password to join.
                        </p>
                        <form onSubmit={handlePasswordSubmit} className={authStyles.modalForm}>
                            <input
                                type="password"
                                placeholder="Enter Room Password..."
                                value={inputPassword}
                                onChange={(e) => setInputPassword && setInputPassword(e.target.value)}
                                className={authStyles.modalInput}
                                autoFocus
                                required
                            />
                            <div className={authStyles.modalActions}>
                                <button type="submit" className={authStyles.modalPrimaryBtn}>
                                    Submit & Join
                                </button>
                                <button
                                    type="button"
                                    className={authStyles.modalSecondaryBtn}
                                    onClick={onClosePasswordModal || (() => router.push("/games/rooms"))}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ROOM ALERT / ERROR MODAL */}
            {showRoomModal && (
                <div className={authStyles.modalOverlay}>
                    <div className={authStyles.modalCard}>
                        <button
                            type="button"
                            className={authStyles.closeModalBtn}
                            onClick={onCloseRoomModal || (() => router.push("/games/rooms"))}
                            aria-label="Close modal"
                        >
                            <FaTimes />
                        </button>
                        <FaExclamationTriangle size={56} className={authStyles.modalIcon} style={{ color: "#ff4d4d" }} />
                        <h3 className={authStyles.modalTitle}>Room Alert</h3>
                        <p className={authStyles.modalDescription}>
                            {roomErrorMsg || "Room not found or has expired."}
                        </p>
                        <div className={authStyles.modalActions}>
                            <button
                                type="button"
                                className={authStyles.modalPrimaryBtn}
                                onClick={() => router.push("/games/rooms")}
                            >
                                Join a New Room
                            </button>
                            <button
                                type="button"
                                className={authStyles.modalSecondaryBtn}
                                onClick={() => router.push("/")}
                            >
                                Go Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GAME NOT STARTED YET MODAL */}
            {showNotStartedModal && (
                <div className={authStyles.modalOverlay}>
                    <div className={authStyles.modalCard}>
                        <button
                            type="button"
                            className={authStyles.closeModalBtn}
                            onClick={onCloseNotStartedModal || (() => router.push(`/games/${roomId}`))}
                            aria-label="Close modal"
                        >
                            <FaTimes />
                        </button>
                        <FaGamepad size={56} className={authStyles.modalIcon} style={{ color: "var(--amber)" }} />
                        <h3 className={authStyles.modalTitle}>Game Not Started</h3>
                        <p className={authStyles.modalDescription}>
                            {notStartedMsg || "The game has not started yet in this room."}
                        </p>
                        <div className={authStyles.modalActions}>
                            <button
                                type="button"
                                className={authStyles.modalPrimaryBtn}
                                onClick={() => router.push(`/games/${roomId}`)}
                            >
                                Go to Waiting Room
                            </button>
                            <button
                                type="button"
                                className={authStyles.modalSecondaryBtn}
                                onClick={() => router.push("/")}
                            >
                                Go Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CHANGE ROOM MODAL */}
            {showChangeRoomModal && (
                <div className={authStyles.modalOverlay}>
                    <div className={authStyles.modalCard}>
                        <button
                            type="button"
                            className={authStyles.closeModalBtn}
                            onClick={handleGoToPrevRoom || (() => router.push("/games/rooms"))}
                            aria-label="Close modal"
                        >
                            <FaTimes />
                        </button>
                        <FaUsers size={56} className={authStyles.modalIcon} />
                        <h3 className={authStyles.modalTitle}>Already in a Room</h3>
                        <p className={authStyles.modalDescription}>
                            You are already in another room <strong>{previousRoomId || "Lobby"}</strong>. Would you like to leave it to join <strong>{roomId}</strong>, or return to your previous room?
                        </p>
                        <div className={authStyles.modalActions}>
                            <button
                                type="button"
                                className={authStyles.modalPrimaryBtn}
                                onClick={handleLeavePrevAndJoinNew}
                            >
                                Leave {previousRoomId || "Previous Room"} & Join This Room
                            </button>
                            <button
                                type="button"
                                className={authStyles.modalSecondaryBtn}
                                onClick={handleGoToPrevRoom}
                            >
                                Go Back to {previousRoomId || "Previous Room"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
