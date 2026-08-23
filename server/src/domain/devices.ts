import { z } from 'zod';
import switchConfig from './switch-config.json';
import sensorConfig from './sensor-config.json';

const topic = z.string().trim().min(1);

const switchConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  commandTopic: topic,
  stateTopic: topic,
});

const sensorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  statusTopic: topic,
});

export type SwitchConfig = z.infer<typeof switchConfigSchema>;
export type SensorConfig = z.infer<typeof sensorConfigSchema>;

/** Ids are the key used across REST, socket events and the state maps, so they must be unique. */
const uniqueIds = <T extends { id: number }>(label: string) =>
  (devices: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<number>();
    devices.forEach((device, index) => {
      if (seen.has(device.id)) {
        ctx.addIssue({ code: 'custom', path: [index], message: `Duplicate ${label} id: ${device.id}` });
      }
      seen.add(device.id);
    });
  };

/**
 * zod reports issues by path (`[0].commandTopic`); resolve the index back to the
 * offending device so a config mistake names the device instead of an index.
 */
const describeIssue = (raw: unknown, issue: z.core.$ZodIssue, label: string): string => {
  const [index, ...rest] = issue.path;
  const device = Array.isArray(raw) && typeof index === 'number'
    ? (raw[index] as { id?: unknown; name?: unknown } | undefined)
    : undefined;
  const who = device ? `${label} "${device.name}" (id ${device.id})` : label;
  const field = rest.length > 0 ? ` ${rest.join('.')}` : '';
  return `${who}${field}: ${issue.message}`;
};

const parse = <T extends { id: number }>(
  schema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T[] => {
  const result = z.array(schema).superRefine(uniqueIds<T>(label)).safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((issue) => describeIssue(raw, issue, label));
    throw new Error(`Invalid ${label} configuration: ${details.join('; ')}`);
  }
  return result.data;
};

export const switches: SwitchConfig[] = parse(switchConfigSchema, switchConfig, 'switch');
export const sensors: SensorConfig[] = parse(sensorConfigSchema, sensorConfig, 'sensor');

export function findSwitchById(id: number): SwitchConfig | undefined {
  return switches.find((s) => s.id === id);
}

export function findSensorById(id: number): SensorConfig | undefined {
  return sensors.find((s) => s.id === id);
}
