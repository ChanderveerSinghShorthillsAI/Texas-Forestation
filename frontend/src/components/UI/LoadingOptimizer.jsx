import React, { useState, useEffect } from 'react';
import './LoadingOptimizer.css';

/**
 * Loading Optimizer Component
 * Shows detailed loading progress for multiple initialization tasks
 */
const LoadingOptimizer = ({ isVisible = true, onComplete = null }) => {
  const [loadingTasks, setLoadingTasks] = useState([
    { id: 'auth', name: 'Authentication', status: 'pending', progress: 0 },
    { id: 'boundaries', name: 'Texas Boundaries', status: 'pending', progress: 0 },
    { id: 'grid', name: 'Grid System', status: 'pending', progress: 0 },
    { id: 'layers', name: 'Map Layers', status: 'pending', progress: 0 },
    { id: 'services', name: 'Backend Services', status: 'pending', progress: 0 }
  ]);

  const [currentTask, setCurrentTask] = useState('auth');
  const [overallProgress, setOverallProgress] = useState(0);

  // Update overall progress when tasks change
  useEffect(() => {
    const completedTasks = loadingTasks.filter(task => task.status === 'completed').length;
    const totalTasks = loadingTasks.length;
    const newProgress = (completedTasks / totalTasks) * 100;
    setOverallProgress(newProgress);

    if (completedTasks === totalTasks && onComplete) {
      setTimeout(onComplete, 500); // Small delay for smooth transition
    }
  }, [loadingTasks, onComplete]);

  const updateTask = (taskId, updates) => {
    setLoadingTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));

    if (updates.status === 'in-progress') {
      setCurrentTask(taskId);
    }
  };

  // Expose update functions globally for use by other components
  useEffect(() => {
    window.updateLoadingTask = updateTask;
    return () => {
      delete window.updateLoadingTask;
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="loading-optimizer">
      <div className="loading-optimizer-content">
        <div className="loading-header">
          <div className="loading-logo">🌲</div>
          <h2>Texas Forestation</h2>
          <p>Initializing your spatial analysis platform...</p>
        </div>

        <div className="progress-section">
          {/* Overall progress bar */}
          <div className="overall-progress">
            <div className="progress-label">
              <span>Loading Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Task list */}
          <div className="task-list">
            {loadingTasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`task-item ${task.status} ${currentTask === task.id ? 'active' : ''}`}
              >
                <div className="task-icon">
                  {task.status === 'completed' && '✅'}
                  {task.status === 'in-progress' && (
                    <div className="mini-spinner"></div>
                  )}
                  {task.status === 'pending' && '⏳'}
                  {task.status === 'error' && '❌'}
                </div>
                <div className="task-info">
                  <div className="task-name">{task.name}</div>
                  {task.status === 'in-progress' && task.progress > 0 && (
                    <div className="task-progress">
                      <div 
                        className="task-progress-fill"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
                <div className="task-status">
                  {task.status === 'completed' && 'Ready'}
                  {task.status === 'in-progress' && 'Loading...'}
                  {task.status === 'pending' && 'Waiting'}
                  {task.status === 'error' && 'Failed'}
                </div>
              </div>
            ))}
          </div>

          {/* Current task details */}
          <div className="current-task">
            <div className="current-task-text">
              {loadingTasks.find(task => task.id === currentTask)?.name || 'Initializing...'}
            </div>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        {/* Performance tip */}
        <div className="loading-tip">
          <div className="tip-icon">💡</div>
          <div className="tip-text">
            First time loading may take longer as we cache data for faster future access
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOptimizer;
