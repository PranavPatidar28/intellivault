"use client";

import { useState } from "react";

export default function ApiTestPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [lastNoteId, setLastNoteId] = useState<string | null>(null);

    const log = (message: string, data?: unknown) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `${timestamp}: ${message} ${data ? JSON.stringify(data, null, 2) : ""
            }`;
        setLogs((prev) => [logMsg, ...prev]);
        console.log(message, data);
    };

    const createNote = async () => {
        try {
            log("Creating note...");
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "Test Note " + Date.now(),
                    contentJSON: { type: "doc", content: [] },
                    contentText: "This is a test note.",
                }),
            });
            const data = await res.json();
            log("Create response:", data);
            if (data.success) {
                setLastNoteId(data.note.id);
            }
        } catch (error) {
            log("Create error:", error);
        }
    };

    const createInvalidNote = async () => {
        try {
            log("Creating invalid note (missing title)...");
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentJSON: {},
                }),
            });
            const data = await res.json();
            log("Create invalid response:", data);
        } catch (error) {
            log("Create invalid error:", error);
        }
    };

    const listNotes = async () => {
        try {
            log("Listing notes (page 1, limit 5)...");
            const res = await fetch("/api/notes?page=1&limit=5");
            const data = await res.json();
            log("List response:", data);
        } catch (error) {
            log("List error:", error);
        }
    };

    const getNote = async () => {
        if (!lastNoteId) return log("No note ID available to get");
        try {
            log(`Getting note ${lastNoteId}...`);
            const res = await fetch(`/api/notes/${lastNoteId}`);
            const data = await res.json();
            log("Get response:", data);
        } catch (error) {
            log("Get error:", error);
        }
    };

    const updateNote = async () => {
        if (!lastNoteId) return log("No note ID available to update");
        try {
            log(`Updating note ${lastNoteId}...`);
            const res = await fetch(`/api/notes/${lastNoteId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "Updated Title " + Date.now(),
                }),
            });
            const data = await res.json();
            log("Update response:", data);
        } catch (error) {
            log("Update error:", error);
        }
    };

    const deleteNote = async () => {
        if (!lastNoteId) return log("No note ID available to delete");
        try {
            log(`Deleting note ${lastNoteId}...`);
            const res = await fetch(`/api/notes/${lastNoteId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            log("Delete response:", data);
            if (data.success) {
                setLastNoteId(null);
            }
        } catch (error) {
            log("Delete error:", error);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
            <div className="flex gap-2 mb-4 flex-wrap">
                <button
                    onClick={createNote}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Create Note
                </button>
                <button
                    onClick={createInvalidNote}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                    Create Invalid Note
                </button>
                <button
                    onClick={listNotes}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    List Notes
                </button>
                <button
                    onClick={getNote}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    disabled={!lastNoteId}
                >
                    Get Note
                </button>
                <button
                    onClick={updateNote}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    disabled={!lastNoteId}
                >
                    Update Note
                </button>
                <button
                    onClick={deleteNote}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    disabled={!lastNoteId}
                >
                    Delete Note
                </button>
                <button
                    onClick={() => setLogs([])}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                    Clear Logs
                </button>
            </div>

            <div className="bg-gray-100 p-4 rounded h-[500px] overflow-auto font-mono text-sm whitespace-pre-wrap">
                {logs.length === 0 ? "Logs will appear here..." : logs.join("\n\n")}
            </div>
        </div>
    );
}
