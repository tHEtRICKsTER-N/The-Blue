'use client';

import { useState } from 'react';
import { Monitor, Smartphone, RotateCcw, Copy, Check, Lock, Waves, AlertTriangle } from 'lucide-react';
import type { DeviceCompatibility } from '@/hooks/use-device-compatibility';

interface IncompatibleDeviceWarningProps {
  compatibility: DeviceCompatibility;
}

export function IncompatibleDeviceWarning({ compatibility }: IncompatibleDeviceWarningProps) {
  const [copied, setCopied] = useState(false);

  if (!compatibility.checked || !compatibility.isIncompatible) {
    return null;
  }

  const handleCopyLink = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  return (
    <div
      className="incompatible-warning-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incompatible-title"
      aria-describedby="incompatible-desc"
    >
      <div className="incompatible-warning-card">
        {/* Header with Wordmark and Status */}
        <div className="incompatible-card-header">
          <div className="incompatible-wordmark">
            <Waves size={20} strokeWidth={1.4} />
            <span>ABYSS<sup>®</sup></span>
          </div>
          <div className="incompatible-badge">
            <span className="incompatible-dot" />
            <span>EXPEDITION BLOCKED</span>
          </div>
        </div>

        {/* Device Visual Comparison */}
        <div className="incompatible-visual">
          <div className="device-item is-supported">
            <div className="device-icon-box">
              <Monitor size={36} strokeWidth={1.5} />
            </div>
            <span className="device-status-tag">Desktop PC</span>
            <span className="device-subtag">Supported</span>
          </div>

          <div className="device-divider">
            <div className="divider-line" />
            <span className="divider-icon">
              {compatibility.reason === 'portrait' ? (
                <RotateCcw size={16} />
              ) : (
                <AlertTriangle size={16} />
              )}
            </span>
            <div className="divider-line" />
          </div>

          <div className="device-item is-unsupported">
            <div className="device-icon-box">
              {compatibility.reason === 'portrait' ? (
                <RotateCcw size={36} strokeWidth={1.5} />
              ) : (
                <Smartphone size={36} strokeWidth={1.5} />
              )}
              <div className="device-block-stripe" />
            </div>
            <span className="device-status-tag">
              {compatibility.reason === 'portrait'
                ? 'Portrait View'
                : compatibility.details.deviceType}
            </span>
            <span className="device-subtag is-restricted">Unsupported</span>
          </div>
        </div>

        {/* Primary Alert Heading & Description */}
        <div className="incompatible-body">
          <div className="incompatible-eyebrow">
            <span /> INCOMPATIBLE DEVICE OR ORIENTATION
          </div>
          <h2 id="incompatible-title">{compatibility.title}</h2>
          <p id="incompatible-desc" className="incompatible-description">
            {compatibility.message}
          </p>
        </div>

        {/* Detected Info vs Requirement */}
        <div className="incompatible-diagnostics">
          <div className="diag-row">
            <span className="diag-label">Detected Device</span>
            <span className="diag-value">{compatibility.details.deviceType}</span>
          </div>
          <div className="diag-row">
            <span className="diag-label">Orientation</span>
            <span className={`diag-value ${compatibility.isPortrait ? 'text-warn' : ''}`}>
              {compatibility.details.orientation.toUpperCase()}
              {compatibility.isPortrait ? ' (Unsupported)' : ''}
            </span>
          </div>
          <div className="diag-row">
            <span className="diag-label">Resolution</span>
            <span className="diag-value">{compatibility.details.dimensions}</span>
          </div>
          <div className="diag-row">
            <span className="diag-label">Launch Status</span>
            <span className="diag-value text-restricted">
              <Lock size={12} /> Game Launch Locked
            </span>
          </div>
        </div>

        {/* Required Hardware & Controls info */}
        <div className="incompatible-requirements">
          <h4>Required for Expedition:</h4>
          <div className="req-pills">
            <span><kbd>W A S D</kbd> Swim Controls</span>
            <span><kbd>SPACE</kbd> Surface / <kbd>C</kbd> Dive</span>
            <span>Mouse 360° Free Look</span>
            <span>Desktop Landscape Display (1024px+)</span>
          </div>
        </div>

        {/* Call to action & helper */}
        <div className="incompatible-actions">
          <button
            type="button"
            className={`copy-link-button ${copied ? 'is-copied' : ''}`}
            onClick={handleCopyLink}
            aria-label="Copy website link to clipboard"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Link Copied — Send it to your PC' : 'Copy Link for PC'}</span>
          </button>
          <p className="incompatible-instruction">
            Open this link on your desktop computer or laptop to dive beneath the surface.
          </p>
        </div>
      </div>
    </div>
  );
}
