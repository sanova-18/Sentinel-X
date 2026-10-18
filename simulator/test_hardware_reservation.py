import unittest
from simulator import simulation_workers
import scenarios


class HardwareReservationTests(unittest.TestCase):
    def test_reset_does_not_reintroduce_hardware_helmet(self):
        workers = simulation_workers(["H-201"])
        for worker in workers:
            worker.is_online = False
        scenarios.apply_scenario_normal(workers)
        self.assertEqual({w.generate_telemetry()["helmetId"] for w in workers}, {"H-202", "H-203"})

    def test_unknown_id_is_rejected(self):
        with self.assertRaises(ValueError):
            simulation_workers(["H201"])

    def test_all_reserved_yields_no_publishers(self):
        self.assertEqual(simulation_workers(["H-201", "H-202", "H-203"]), [])


if __name__ == "__main__":
    unittest.main()
