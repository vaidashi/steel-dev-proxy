import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { IMetrics } from './types/metrics.interface';

@Injectable()
export class MetricsService implements OnApplicationShutdown{
    public totalBandwidth = 0;
    public siteVisits: { [key: string]: number} = {};

    incrementBandwidth(bytes: number) {
        this.totalBandwidth += bytes;
    }

    incrementSiteVisits(site: string) {
        if (!this.siteVisits[site]) {
            this.siteVisits[site] = 0;
        }
        this.siteVisits[site]++;
    }

    getServerMetrics(): IMetrics {
        const topSites = Object.entries(this.siteVisits).map(([url, visits]) => (
            { url, visits })
        );
       
        return {
            bandwidth_usage: this.totalBandwidth.toString(),
            top_sites: topSites,
        };
    }

    getSummaryMetrics(): IMetrics {
        const topSites = Object.entries(this.siteVisits)
            .map(([url, visits]) => ({ url, visits }))
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 5);

        return {
            bandwidth_usage: this.totalBandwidth.toString(),
            top_sites: topSites,
        };
    }

    onApplicationShutdown(signal: string) {
        console.log(`Received shutdown signal: ${signal}`);
        const metricsSummary = this.getSummaryMetrics();
        
        console.log('Metrics Summary:');
        console.log(`Total Bandwidth: ${metricsSummary.bandwidth_usage}`);
        console.log('Top Sites:');
        metricsSummary.top_sites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.url} - ${site.visits} visits`);
        });
    }
}
