import { useCallback, useEffect, useState } from 'react';
import type { DeviceType, LinkedDevice, OnboardedChild } from '@revisionden/core';
import { Button, Card } from '../../components';
import { useOnboardingApi } from './OnboardingApiContext';

const TYPE_LABELS: Record<DeviceType, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  computer: 'Computer',
};

const linkedOn = (iso: string) =>
  `Linked ${new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  })}`;

interface ChildDevices {
  child: OnboardedChild;
  devices: LinkedDevice[];
}

/** Parent area: each child's linked devices (type, date linked), with Remove. */
export function LinkedDevicesCard() {
  const api = useOnboardingApi();
  const [rows, setRows] = useState<ChildDevices[]>([]);
  const [confirming, setConfirming] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const family = await api.getFamily();
      const next = await Promise.all(
        family.children.map(async (child) => ({
          child,
          devices: await api.listDevices(child.student.id).catch(() => []),
        })),
      );
      setRows(next);
    } catch {
      setRows([]);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (studentId: string, deviceId: string) => {
    setError(undefined);
    try {
      await api.removeDevice(studentId, deviceId);
      setConfirming(undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the device.');
    }
  };

  if (rows.length === 0) return null;

  return (
    <Card title="Linked devices" className="linked-devices">
      {rows.map(({ child, devices }) => {
        const { nickname, id: studentId } = child.student;
        return (
          <div key={studentId} className="stack">
            <h3>{nickname}</h3>
            {devices.length === 0 ? (
              <p className="secondary-text">No devices linked for {nickname} yet.</p>
            ) : (
              <ul aria-label={`${nickname}'s devices`} className="linked-devices__list">
                {devices.map((d) => (
                  <li key={d.id} className="linked-devices__item">
                    <span className="profile__text">
                      <span className="profile__name">
                        {d.deviceType ? TYPE_LABELS[d.deviceType] : 'Device'}
                      </span>
                      <span className="secondary-text">{linkedOn(d.linkedAt)}</span>
                    </span>
                    {confirming === d.id ? (
                      <span className="stack">
                        <span>This signs the device out. Link it again to use it.</span>
                        <Button variant="danger" onClick={() => remove(studentId, d.id)}>
                          Yes, remove it
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirming(undefined)}>
                          Keep it
                        </Button>
                      </span>
                    ) : (
                      <Button variant="secondary" onClick={() => setConfirming(d.id)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
    </Card>
  );
}
