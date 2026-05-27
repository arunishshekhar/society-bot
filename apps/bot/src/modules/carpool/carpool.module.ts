import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CarpoolService } from "./carpool.service";
import { CarpoolScheduler } from "./carpool.scheduler";
import { OrsService } from "./ors.service";
import { PhotonService } from "./photon.service";
import { PolylineService } from "./polyline.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    CarpoolService,
    CarpoolScheduler,
    OrsService,
    PhotonService,
    PolylineService,
  ],
  exports: [CarpoolService, OrsService, PhotonService, PolylineService],
})
export class CarpoolModule {}
