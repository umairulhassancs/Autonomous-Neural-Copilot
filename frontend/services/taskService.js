import {
    collection,
    addDoc,
    updateDoc,
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
 * Add a new task
 */
export async function addTask(userId, description) {
    try {
        const docRef = await addDoc(collection(db, 'tasks'), {
            userId: userId,
            description: description,
            completed: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Add task error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all tasks for a user
 */
export async function getTasks(userId) {
    try {
        // Simplified query without orderBy to avoid index requirement
        const q = query(
            collection(db, 'tasks'),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const tasks = [];

        querySnapshot.forEach((doc) => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by createdAt in JavaScript instead of Firestore
        tasks.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime; // Descending order (newest first)
        });

        return { success: true, tasks };
    } catch (error) {
        console.error('Get tasks error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update task (mark as complete/incomplete)
 */
export async function updateTask(taskId, updates) {
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });

        return { success: true };
    } catch (error) {
        console.error('Update task error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId) {
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
        return { success: true };
    } catch (error) {
        console.error('Delete task error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Rename a task
 */
export async function renameTask(taskId, newDescription) {
    return updateTask(taskId, { description: newDescription });
}

/**
 * Toggle task completion
 */
export async function toggleTaskCompletion(taskId, currentStatus) {
    return updateTask(taskId, { completed: !currentStatus });
}

export default {
    addTask,
    getTasks,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    renameTask
};
