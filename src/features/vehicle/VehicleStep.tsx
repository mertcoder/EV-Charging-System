import type { FormEvent } from "react";
import { Car, ChevronRight, ShieldCheck } from "lucide-react";
import type { Vehicle } from "../../shared/domain";
import { Empty, Input, PanelTitle } from "../../components/common";

export function VehicleStep(props: {
  vehicles: Vehicle[];
  form: Record<string, string>;
  setForm: (form: any) => void;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  onSubmit: (event: FormEvent) => void;
  onContinue: () => void;
}) {
  const { vehicles, form, setForm, selectedVehicleId, setSelectedVehicleId, onSubmit, onContinue } = props;
  return (
    <section className="flow-grid">
      <div className="hero-panel">
        <h2>Add a vehicle</h2>
        <p>Connector compatibility is checked automatically during reservation.</p>
        <form className="clean-form" onSubmit={onSubmit}>
          <div className="inline-fields">
            <Input label="Brand" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} />
            <Input label="Model" value={form.modelName} onChange={(value) => setForm({ ...form, modelName: value })} />
          </div>
          <div className="inline-fields">
            <Input label="Battery" suffix="kWh" type="number" value={form.batteryCapacityKwh} onChange={(value) => setForm({ ...form, batteryCapacityKwh: value })} />
            <label>
              Connector
              <select value={form.connectorType} onChange={(event) => setForm({ ...form, connectorType: event.target.value })}>
                <option value="CCS">CCS</option>
                <option value="TYPE_2">Type 2</option>
                <option value="CHADEMO">CHAdeMO</option>
              </select>
            </label>
          </div>
          <Input label="Plate number" value={form.plateNumber} onChange={(value) => setForm({ ...form, plateNumber: value.toUpperCase() })} />
          <button className="primary wide" type="submit">
            <Car /> Save Vehicle
          </button>
        </form>
      </div>

      <div className="side-panel">
        <PanelTitle icon={<ShieldCheck />} title="Saved vehicles" />
        <div className="vehicle-list">
          {vehicles.length === 0 ? (
            <Empty text="No vehicles saved yet." />
          ) : (
            vehicles.map((vehicle) => (
              <button key={vehicle.id} className={`vehicle-card ${selectedVehicleId === vehicle.id ? "selected" : ""}`} onClick={() => setSelectedVehicleId(vehicle.id)}>
                <span>
                  {vehicle.brand} {vehicle.modelName}
                </span>
                <strong>{vehicle.connectorType}</strong>
                <small className="mono">{vehicle.plateNumber} - {vehicle.batteryCapacityKwh} kWh</small>
              </button>
            ))
          )}
        </div>
        <button className="secondary wide" onClick={onContinue} disabled={vehicles.length === 0}>
          Find a charging station <ChevronRight />
        </button>
      </div>
    </section>
  );
}
