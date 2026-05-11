import type { FormEvent } from "react";
import { Car, ChevronRight, ShieldCheck } from "lucide-react";
import type { Vehicle } from "../../shared/domain";
import { Empty, Input, PanelTitle } from "../../components/common";

type ConnectorType = "CCS" | "TYPE_2" | "CHADEMO";

type VehiclePreset = {
  battery: number;
  connector: ConnectorType;
};

const VEHICLE_PRESETS: Record<string, Record<string, VehiclePreset>> = {
  Tesla: {
    "Model 3": { battery: 60, connector: "CCS" },
    "Model 3 Long Range": { battery: 79, connector: "CCS" },
    "Model 3 Performance": { battery: 82, connector: "CCS" },
    "Model Y": { battery: 75, connector: "CCS" },
    "Model Y Long Range": { battery: 81, connector: "CCS" },
    "Model S": { battery: 100, connector: "CCS" },
    "Model S Plaid": { battery: 100, connector: "CCS" },
    "Model X": { battery: 100, connector: "CCS" },
    Cybertruck: { battery: 123, connector: "CCS" }
  },
  BMW: {
    i3: { battery: 42, connector: "CCS" },
    i4: { battery: 80, connector: "CCS" },
    "i4 M50": { battery: 80, connector: "CCS" },
    iX: { battery: 105, connector: "CCS" },
    "iX M60": { battery: 111, connector: "CCS" },
    i5: { battery: 84, connector: "CCS" },
    i7: { battery: 105, connector: "CCS" },
    iX1: { battery: 65, connector: "CCS" },
    iX3: { battery: 80, connector: "CCS" }
  },
  Volkswagen: {
    "e-Up!": { battery: 32, connector: "CCS" },
    "ID.3": { battery: 58, connector: "CCS" },
    "ID.4": { battery: 77, connector: "CCS" },
    "ID.5": { battery: 77, connector: "CCS" },
    "ID.7": { battery: 86, connector: "CCS" },
    "ID. Buzz": { battery: 82, connector: "CCS" }
  },
  Hyundai: {
    "Ioniq 5": { battery: 77, connector: "CCS" },
    "Ioniq 5 N": { battery: 84, connector: "CCS" },
    "Ioniq 6": { battery: 77, connector: "CCS" },
    "Kona Electric": { battery: 64, connector: "CCS" }
  },
  Kia: {
    EV6: { battery: 77, connector: "CCS" },
    "EV6 GT": { battery: 84, connector: "CCS" },
    EV9: { battery: 99, connector: "CCS" },
    "Niro EV": { battery: 64, connector: "CCS" },
    "Soul EV": { battery: 64, connector: "CCS" }
  },
  Renault: {
    Zoe: { battery: 52, connector: "TYPE_2" },
    "Megane E-Tech": { battery: 60, connector: "CCS" },
    "Scenic E-Tech": { battery: 87, connector: "CCS" },
    Twingo: { battery: 22, connector: "TYPE_2" }
  },
  Audi: {
    "e-tron GT": { battery: 93, connector: "CCS" },
    "RS e-tron GT": { battery: 93, connector: "CCS" },
    "Q4 e-tron": { battery: 82, connector: "CCS" },
    "Q6 e-tron": { battery: 100, connector: "CCS" },
    "Q8 e-tron": { battery: 114, connector: "CCS" }
  },
  "Mercedes-Benz": {
    EQE: { battery: 90, connector: "CCS" },
    "EQE SUV": { battery: 90, connector: "CCS" },
    EQS: { battery: 108, connector: "CCS" },
    "EQS SUV": { battery: 108, connector: "CCS" },
    EQA: { battery: 66, connector: "CCS" },
    EQB: { battery: 66, connector: "CCS" },
    EQV: { battery: 90, connector: "CCS" }
  },
  Volvo: {
    EX30: { battery: 64, connector: "CCS" },
    EX40: { battery: 78, connector: "CCS" },
    EC40: { battery: 78, connector: "CCS" },
    EX90: { battery: 111, connector: "CCS" }
  },
  Polestar: {
    "2": { battery: 78, connector: "CCS" },
    "3": { battery: 111, connector: "CCS" },
    "4": { battery: 100, connector: "CCS" }
  },
  Porsche: {
    Taycan: { battery: 93, connector: "CCS" },
    "Taycan Turbo S": { battery: 93, connector: "CCS" },
    "Macan Electric": { battery: 100, connector: "CCS" },
    "Macan Turbo Electric": { battery: 100, connector: "CCS" }
  },
  Ford: {
    "Mustang Mach-E": { battery: 91, connector: "CCS" },
    "Mustang Mach-E GT": { battery: 91, connector: "CCS" },
    "F-150 Lightning": { battery: 131, connector: "CCS" },
    "E-Transit": { battery: 68, connector: "CCS" }
  },
  Nissan: {
    Leaf: { battery: 62, connector: "CHADEMO" },
    "Leaf e+": { battery: 62, connector: "CHADEMO" },
    Ariya: { battery: 87, connector: "CCS" }
  },
  Togg: {
    "T10X V1 RWD Standard Range": { battery: 52, connector: "CCS" },
    "T10X V1 RWD Long Range": { battery: 88, connector: "CCS" },
    "T10X V1 AWD Long Range": { battery: 88, connector: "CCS" }
  },
  Peugeot: {
    "e-208": { battery: 51, connector: "CCS" },
    "e-2008": { battery: 51, connector: "CCS" },
    "e-308": { battery: 54, connector: "CCS" },
    "e-3008": { battery: 73, connector: "CCS" }
  },
  Citroen: {
    "e-C3": { battery: 44, connector: "CCS" },
    "e-C4": { battery: 51, connector: "CCS" },
    "e-Berlingo": { battery: 50, connector: "CCS" }
  },
  Opel: {
    "Corsa-e": { battery: 51, connector: "CCS" },
    "Mokka-e": { battery: 51, connector: "CCS" },
    "Astra Electric": { battery: 54, connector: "CCS" }
  },
  Fiat: {
    "500e": { battery: 42, connector: "CCS" },
    "600e": { battery: 54, connector: "CCS" }
  },
  MG: {
    "MG4": { battery: 64, connector: "CCS" },
    "MG5 EV": { battery: 61, connector: "CCS" },
    "ZS EV": { battery: 70, connector: "CCS" },
    "Marvel R": { battery: 70, connector: "CCS" }
  },
  Skoda: {
    "Enyaq iV": { battery: 82, connector: "CCS" },
    "Enyaq Coupe iV": { battery: 82, connector: "CCS" }
  },
  Cupra: {
    Born: { battery: 77, connector: "CCS" },
    Tavascan: { battery: 77, connector: "CCS" }
  },
  Mini: {
    "Cooper SE": { battery: 32, connector: "CCS" },
    "Countryman SE": { battery: 66, connector: "CCS" }
  },
  Honda: {
    "e:Ny1": { battery: 68, connector: "CCS" },
    "Honda e": { battery: 36, connector: "CCS" }
  },
  Mazda: {
    "MX-30": { battery: 35, connector: "CCS" }
  },
  Subaru: {
    Solterra: { battery: 71, connector: "CCS" }
  },
  Toyota: {
    "bZ4X": { battery: 71, connector: "CCS" },
    "Proace Verso Electric": { battery: 75, connector: "CCS" }
  },
  Lexus: {
    "RZ 450e": { battery: 71, connector: "CCS" },
    "UX 300e": { battery: 72, connector: "CCS" }
  },
  Genesis: {
    "GV60": { battery: 77, connector: "CCS" },
    "Electrified GV70": { battery: 77, connector: "CCS" },
    "Electrified G80": { battery: 87, connector: "CCS" }
  },
  Jaguar: {
    "I-Pace": { battery: 90, connector: "CCS" }
  },
  Smart: {
    "#1": { battery: 66, connector: "CCS" },
    "#3": { battery: 66, connector: "CCS" }
  },
  BYD: {
    Atto3: { battery: 60, connector: "CCS" },
    Dolphin: { battery: 60, connector: "CCS" },
    Seal: { battery: 82, connector: "CCS" },
    "Han EV": { battery: 85, connector: "CCS" }
  }
};

const VEHICLE_BRANDS = Object.keys(VEHICLE_PRESETS).sort();

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
  const modelsForBrand = VEHICLE_PRESETS[form.brand] ? Object.keys(VEHICLE_PRESETS[form.brand]) : [];
  const allModels = modelsForBrand.length > 0 ? modelsForBrand : Object.values(VEHICLE_PRESETS).flatMap((m) => Object.keys(m));
  const datalistId = `vehicle-model-list-${form.brand?.replace(/\W+/g, "-").toLowerCase() || "all"}`;

  function applyModelPreset(brand: string, modelName: string) {
    const preset = VEHICLE_PRESETS[brand]?.[modelName];
    if (!preset) return null;
    return preset;
  }

  return (
    <section className="flow-grid">
      <div className="hero-panel">
        <h2>Add a vehicle</h2>
        <p>Pick from the suggestions or type your own — connector compatibility is checked automatically during reservation.</p>
        <form className="clean-form" onSubmit={onSubmit}>
          <div className="inline-fields">
            <label>
              <span>Brand</span>
              <input
                list="vehicle-brand-list"
                value={form.brand}
                placeholder="e.g. Tesla"
                onChange={(event) => {
                  const brand = event.target.value;
                  const next: Record<string, string> = { ...form, brand };
                  const preset = applyModelPreset(brand, form.modelName);
                  if (preset) {
                    next.batteryCapacityKwh = String(preset.battery);
                    next.connectorType = preset.connector;
                  }
                  setForm(next);
                }}
              />
              <datalist id="vehicle-brand-list">
                {VEHICLE_BRANDS.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Model</span>
              <input
                list={datalistId}
                value={form.modelName}
                placeholder={modelsForBrand.length > 0 ? `e.g. ${modelsForBrand[0]}` : "e.g. Model Y"}
                onChange={(event) => {
                  const modelName = event.target.value;
                  const next: Record<string, string> = { ...form, modelName };
                  const preset = applyModelPreset(form.brand, modelName);
                  if (preset) {
                    next.batteryCapacityKwh = String(preset.battery);
                    next.connectorType = preset.connector;
                  }
                  setForm(next);
                }}
              />
              <datalist id={datalistId}>
                {allModels.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
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
