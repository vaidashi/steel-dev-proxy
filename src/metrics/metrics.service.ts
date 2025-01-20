import { Injectable } from '@nestjs/common';
import { IMetrics } from './types/metrics.interface';

@Injectable()
export class MetricsService {
    totalBandwidth = 0;
    siteVisits: { [key: string]: number} = {};

    incrementBandwidth(bytes: number) {
        this.totalBandwidth += bytes;
    }

    incrementSiteVisits(site: string) {
        if (!this.siteVisits[site]) {
            this.siteVisits[site] = 0;
        }
        this.siteVisits[site]++;
    }

    getLiveServerMetrics(): IMetrics {
        const topSites = Object.entries(this.siteVisits).map(([url, visits]) => (
            { url, visits })
        );

        return {
            bandwidth_usage: this.totalBandwidth.toString(),
            top_sites: topSites,
        };
    }
}
