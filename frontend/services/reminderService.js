import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * Add a new reminder
 */
export async function addReminder(userId, description, reminderDate = null) {
    try {
        const docRef = await addDoc(collection(db, 'reminders'), {
            userId: userId,
            description: description,
            reminderDate: reminderDate ? Timestamp.fromDate(new Date(reminderDate)) : null,
            notified: false,
            createdAt: Timestamp.now()
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Add reminder error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all reminders for a user
 */
export async function getReminders(userId) {
    try {
        // Simplified query without orderBy to avoid index requirement
        const q = query(
            collection(db, 'reminders'),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const reminders = [];

        querySnapshot.forEach((doc) => {
            reminders.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by createdAt in JavaScript instead of Firestore
        reminders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime; // Descending order (newest first)
        });

        return { success: true, reminders };
    } catch (error) {
        console.error('Get reminders error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId) {
    try {
        await deleteDoc(doc(db, 'reminders', reminderId));
        return { success: true };
    } catch (error) {
        console.error('Delete reminder error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send reminder notification via WhatsApp
 */
export async function sendReminderNotification(userId, reminderText, whatsappNumber) {
    try {
        if (!whatsappNumber) {
            return { success: false, error: 'No WhatsApp number provided' };
        }

        const response = await fetch('http://localhost:3000/api/send-reminder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                reminderText: reminderText,
                whatsappNumber: whatsappNumber
            })
        });

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Send reminder notification error:', error);
        return { success: false, error: error.message };
    }
}

export default {
    addReminder,
    getReminders,
    deleteReminder,
    sendReminderNotification
};
