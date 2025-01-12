export interface SwitchEvent {
  id: number;
  data: {
    device: string;
    state: boolean;
  }
}